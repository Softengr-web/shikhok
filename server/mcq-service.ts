import { createHash, randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { DomainError } from './services.js';
import { deriveGamification, fisherYates, scoreAnswers, type McqOption, type ScoringConfig } from './mcq-domain.js';
import { getMcqMediaObject, mcqObjectStorageConfigured, putMcqMediaObject } from './mcq-media-storage.js';
import type { User } from './types.js';

let client: PrismaClient | undefined;
export function mcqDatabase() {
  if (!process.env.DATABASE_URL) throw new DomainError('প্রশ্ন ব্যাংকের ডাটাবেস সংযুক্ত হয়নি। প্রশাসককে DATABASE_URL সেট করে Prisma migration চালাতে হবে।', 503);
  return client ??= new PrismaClient();
}

export async function persistMcqUser(user: Actor) {
  if (!process.env.DATABASE_URL) return;
  if (!user.email || !user.name || !user.passwordHash) throw new DomainError('অ্যাকাউন্টের তথ্য অসম্পূর্ণ। আবার লগইন করুন।', 401);
  const createdAt = user.createdAt && Number.isFinite(Date.parse(user.createdAt)) ? new Date(user.createdAt) : new Date();
  await mcqDatabase().user.upsert({
    where: { id: user.id },
    create: { id: user.id, email: user.email, passwordHash: user.passwordHash, role: user.role as any, name: user.name, phone: user.phone ?? null, createdAt, deletedAt: user.active === false ? new Date() : null },
    update: { email: user.email, passwordHash: user.passwordHash, role: user.role as any, name: user.name, phone: user.phone ?? null, deletedAt: user.active === false ? new Date() : null }
  });
}

export async function persistMcqBootstrapAdmin(user: User): Promise<User> {
  if (!process.env.DATABASE_URL) return user;
  if (!user.email || !user.name || !user.passwordHash) throw new DomainError('প্রশাসক অ্যাকাউন্টের তথ্য অসম্পূর্ণ।', 500);
  const db = mcqDatabase();
  const existing = await db.user.findUnique({ where: { email: user.email }, select: { id: true, createdAt: true } });
  const stableUser = { ...user, id: existing?.id ?? user.id, role: 'ADMIN' as const };
  const createdAt = existing?.createdAt ?? (user.createdAt && Number.isFinite(Date.parse(user.createdAt)) ? new Date(user.createdAt) : new Date());
  await db.user.upsert({
    where: { email: user.email },
    create: { id: stableUser.id, email: user.email, passwordHash: user.passwordHash, role: 'ADMIN', name: user.name, phone: user.phone ?? null, createdAt, deletedAt: null },
    update: { passwordHash: user.passwordHash, role: 'ADMIN', name: user.name, phone: user.phone ?? null, deletedAt: null }
  });
  return stableUser;
}

type Actor = Pick<User, 'id' | 'role'> & Partial<Pick<User, 'email' | 'name' | 'passwordHash' | 'phone' | 'createdAt' | 'active'>>;
type FilterInput = { classLevel?: unknown; groupName?: unknown; subject?: unknown; part?: unknown; chapters?: unknown };
const value = (input: unknown) => typeof input === 'string' ? input.trim() : '';
const nullable = (input: unknown) => value(input) || null;
const json = (input: unknown): any => input as any;
const sha256 = (input: string) => createHash('sha256').update(input, 'utf8').digest('hex');
const canonical = (text: string) => text.replace(/\s+/gu, ' ').trim().toLocaleLowerCase('bn-BD');

type QuestionScope = { classLevel?: string | null; groupName?: string | null; subject?: string | null; part?: string | null; chapter?: string | null; topic?: string | null };

export function questionContentHash(question: string, options: McqOption[], scope: QuestionScope = {}) {
  return sha256(JSON.stringify([
    canonical(scope.classLevel || ''), canonical(scope.groupName || ''), canonical(scope.subject || ''),
    canonical(scope.part || ''), canonical(scope.chapter || ''), canonical(scope.topic || ''),
    canonical(question), options.map(option => canonical(option.text))
  ]));
}

export function questionHash(question: string, options: McqOption[], scope: QuestionScope = {}, mediaHashes: string[] = []) {
  return sha256(JSON.stringify([questionContentHash(question, options, scope), [...mediaHashes].map(canonical).sort()]));
}

function filters(input: FilterInput): Prisma.McqQuestionWhereInput {
  const where: Prisma.McqQuestionWhereInput = { status: 'PUBLISHED' };
  if (value(input.classLevel)) where.classLevel = value(input.classLevel);
  if (value(input.groupName)) where.groupName = value(input.groupName);
  if (value(input.subject)) where.subject = value(input.subject);
  if (value(input.part)) where.part = value(input.part);
  const chapters = Array.isArray(input.chapters) ? input.chapters.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map(item => item.trim()) : [];
  if (chapters.length) where.chapter = { in: chapters };
  return where;
}

export async function mcqCatalog(input: FilterInput = {}) {
  const db = mcqDatabase();
  const where = filters(input);
  const [classes, groups, subjects, parts, chapters, availableCount] = await Promise.all([
    db.mcqQuestion.findMany({ where, distinct: ['classLevel'], select: { classLevel: true }, orderBy: { classLevel: 'asc' } }),
    db.mcqQuestion.findMany({ where, distinct: ['groupName'], select: { groupName: true }, orderBy: { groupName: 'asc' } }),
    db.mcqQuestion.findMany({ where, distinct: ['subject'], select: { subject: true }, orderBy: { subject: 'asc' } }),
    db.mcqQuestion.findMany({ where, distinct: ['part'], select: { part: true }, orderBy: { part: 'asc' } }),
    db.mcqQuestion.findMany({ where, distinct: ['chapter'], select: { chapter: true }, orderBy: { chapter: 'asc' } }),
    db.mcqQuestion.count({ where })
  ]);
  return {
    classes: classes.map(row => row.classLevel),
    groups: groups.map(row => row.groupName).filter((item): item is string => Boolean(item)),
    subjects: subjects.map(row => row.subject),
    parts: parts.map(row => row.part).filter((item): item is string => Boolean(item)),
    chapters: chapters.map(row => row.chapter).filter((item): item is string => Boolean(item)),
    availableCount
  };
}

function safeSnapshot(snapshot: any, reveal: boolean) {
  if (reveal) return snapshot;
  const question = { ...snapshot };
  delete question.correctOption;
  delete question.explanation;
  return question;
}

function attemptPayload(attempt: any) {
  const now = Date.now();
  const expiresAt = attempt.expiresAt?.getTime() ?? null;
  return {
    id: attempt.id,
    status: attempt.status,
    classLevel: attempt.classLevel,
    groupName: attempt.groupName,
    subject: attempt.subject,
    part: attempt.part,
    chapters: attempt.chapters,
    mode: attempt.mode,
    questionCount: attempt.questionCount,
    durationMinutes: attempt.durationMinutes,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    remainingSeconds: expiresAt === null ? null : Math.max(0, Math.ceil((expiresAt - now) / 1000)),
    questions: [...attempt.questions].sort((a: any, b: any) => a.position - b.position).map((item: any) => ({
      position: item.position,
      questionId: item.questionId,
      ...safeSnapshot(item.snapshot, false),
      selectedOption: item.selectedOption,
      markedForReview: item.markedForReview,
      answeredAt: item.answeredAt
    }))
  };
}

function resultPayload(attempt: any) {
  const questions = [...attempt.questions].sort((a: any, b: any) => a.position - b.position);
  const review = questions.map((item: any) => {
    const snapshot = item.snapshot;
    return {
      position: item.position,
      questionId: item.questionId,
      question: snapshot.question,
      options: snapshot.options,
      mediaIds: snapshot.mediaIds || [],
      selectedOption: item.selectedOption,
      correctOption: snapshot.correctOption,
      selectedIsCorrect: item.selectedOption === snapshot.correctOption,
      explanation: snapshot.explanation || '',
      chapter: snapshot.chapter || attempt.chapter || null
    };
  });
  const nextSteps: string[] = [];
  const weakest = new Map<string, { right: number; total: number }>();
  for (const item of review) {
    const name = item.chapter || attempt.subject;
    const group = weakest.get(name) || { right: 0, total: 0 };
    group.total++;
    if (item.selectedIsCorrect) group.right++;
    weakest.set(name, group);
  }
  const weakChapter = [...weakest.entries()].sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total)[0];
  if (attempt.unansweredCount) nextSteps.push(`${attempt.unansweredCount}টি উত্তরহীন প্রশ্ন আগে নিজে সমাধান করে দেখুন।`);
  if (weakChapter && weakChapter[1].right < weakChapter[1].total) nextSteps.push(`${weakChapter[0]} অংশের ভুল উত্তরগুলো আবার অনুশীলন করুন।`);
  if (!nextSteps.length) nextSteps.push('এই ধারাবাহিকতা বজায় রাখতে নতুন chapter থেকে একটি ছোট পরীক্ষা দিন।');
  return {
    id: attempt.id,
    status: attempt.status,
    score: attempt.score,
    totalScore: attempt.totalScore,
    percentage: attempt.totalScore ? Math.max(0, attempt.score / attempt.totalScore * 100) : 0,
    correctCount: attempt.correctCount,
    wrongCount: attempt.wrongCount,
    unansweredCount: attempt.unansweredCount,
    accuracy: attempt.accuracy,
    timeTakenSeconds: attempt.timeTakenSeconds,
    durationMinutes: attempt.durationMinutes,
    xpEarned: attempt.xpEarned,
    submittedAt: attempt.submittedAt,
    classLevel: attempt.classLevel,
    groupName: attempt.groupName,
    subject: attempt.subject,
    part: attempt.part,
    chapters: attempt.chapters,
    questionCount: attempt.questionCount,
    review,
    nextSteps
  };
}

async function currentOwnedAttempt(studentId: string, attemptId: string) {
  const attempt = await mcqDatabase().mcqExamAttempt.findFirst({ where: { id: attemptId, studentId }, include: { questions: true } });
  if (!attempt) throw new DomainError('পরীক্ষাটি পাওয়া যায়নি।', 404);
  return attempt;
}

export async function getActiveMcqAttempt(actor: Actor) {
  const attempt = await mcqDatabase().mcqExamAttempt.findFirst({ where: { studentId: actor.id, status: 'IN_PROGRESS' }, include: { questions: { orderBy: { position: 'asc' } } } });
  if (!attempt) return null;
  if (attempt.expiresAt && attempt.expiresAt <= new Date()) {
    await submitMcqAttempt(actor, attempt.id, true);
    return null;
  }
  return attemptPayload(attempt);
}

async function modeQuestionIds(actor: Actor, mode: string, where: Prisma.McqQuestionWhereInput): Promise<string[] | null> {
  const db = mcqDatabase();
  if (mode === 'STANDARD') return null;
  if (mode === 'BOOKMARKED') {
    const rows = await db.mcqBookmark.findMany({ where: { studentId: actor.id, question: { is: where } }, select: { questionId: true } });
    return rows.map(row => row.questionId);
  }
  if (mode === 'MISTAKES') {
    const rows = await db.mcqAttemptQuestion.findMany({ where: { attempt: { is: { studentId: actor.id, status: { in: ['SUBMITTED', 'AUTO_SUBMITTED'] } } }, questionId: { not: null }, selectedOption: { not: null } }, select: { questionId: true, selectedOption: true, snapshot: true }, take: 25_000, orderBy: { id: 'desc' } });
    const ids = new Set<string>();
    for (const row of rows) if (row.questionId && row.selectedOption !== (row.snapshot as any).correctOption) ids.add(row.questionId);
    return [...ids];
  }
  throw new DomainError('পরীক্ষার mode সঠিক নয়।');
}

export async function startMcqAttempt(actor: Actor, input: Record<string, unknown>) {
  const db = mcqDatabase();
  await persistMcqUser(actor);
  const active = await db.mcqExamAttempt.findFirst({ where: { studentId: actor.id, status: 'IN_PROGRESS' }, select: { id: true } });
  if (active) throw new DomainError('আপনার একটি অসমাপ্ত পরীক্ষা আছে। সেটি চালিয়ে যান বা আগে বাতিল করুন।', 409);
  const classLevel = value(input.classLevel);
  const subject = value(input.subject);
  if (!classLevel || !subject) throw new DomainError('Class ও Subject বেছে নিন।');
  const groupName = nullable(input.groupName);
  const part = nullable(input.part);
  const chapters = Array.isArray(input.chapters) ? [...new Set(input.chapters.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map(item => item.trim()))] : [];
  const questionCount = Math.max(1, Math.min(100, Math.floor(Number(input.questionCount) || 10)));
  const durationMinutesValue = Number(input.durationMinutes);
  const durationMinutes = durationMinutesValue === 0 ? null : Math.max(1, Math.min(180, Math.floor(durationMinutesValue || 10)));
  const mode = value(input.mode || 'STANDARD').toUpperCase();
  const where = filters({ classLevel, groupName, subject, part, chapters });
  const scopedIds = await modeQuestionIds(actor, mode, where);
  if (scopedIds && !scopedIds.length) throw new DomainError(mode === 'MISTAKES' ? 'ভুল করা প্রশ্ন পাওয়া যায়নি।' : 'সংরক্ষিত প্রশ্ন পাওয়া যায়নি।', 404);
  const selectionWhere: Prisma.McqQuestionWhereInput = scopedIds ? { ...where, id: { in: scopedIds } } : where;
  const availableCount = await db.mcqQuestion.count({ where: selectionWhere });
  if (availableCount < questionCount) throw new DomainError(`এই topic-এ ${availableCount}টি প্রশ্ন আছে। প্রশ্ন সংখ্যা কমান অথবা filter পরিবর্তন করুন।`, 409);

  // Random offset windows keep the query bounded; shuffled output and multiple
  // windows avoid loading the whole bank into either the API or student browser.
  const sample: Array<{ id: string; classLevel: string; groupName: string | null; subject: string; part: string | null; chapter: string | null; topic: string | null; questionText: string; options: Prisma.JsonValue; correctOption: number; explanation: string | null; mediaIds: Prisma.JsonValue }> = [];
  const selected = new Set<string>();
  const target = Math.min(availableCount, Math.max(questionCount * 3, questionCount));
  for (let run = 0; run < 8 && sample.length < questionCount; run++) {
    const windowSize = Math.min(target, availableCount);
    const maxSkip = Math.max(0, availableCount - windowSize);
    const skip = Math.floor(Math.random() * (maxSkip + 1));
    const rows = await db.mcqQuestion.findMany({ where: selectionWhere, orderBy: { id: 'asc' }, skip, take: windowSize, select: { id: true, classLevel: true, groupName: true, subject: true, part: true, chapter: true, topic: true, questionText: true, options: true, correctOption: true, explanation: true, mediaIds: true } });
    for (const row of fisherYates(rows)) if (!selected.has(row.id)) { selected.add(row.id); sample.push(row); }
  }
  if (sample.length < questionCount) throw new DomainError('প্রশ্নগুলো বেছে নিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।', 503);
  const chosen = fisherYates(sample).slice(0, questionCount);
  const startedAt = new Date();
  const expiresAt = durationMinutes === null ? null : new Date(startedAt.getTime() + durationMinutes * 60_000);
  const config: ScoringConfig = {
    correctMark: Math.max(0.1, Math.min(100, Number(input.correctMark) || 1)),
    wrongPenalty: Math.max(0, Math.min(100, Number(input.wrongPenalty) || 0)),
    unansweredMark: 0
  };
  const attemptId = randomUUID();
  const created = await db.mcqExamAttempt.create({
    data: {
      id: attemptId, studentId: actor.id, classLevel, groupName, subject, part, chapters: json(chapters), mode,
      questionCount, durationMinutes, startedAt, expiresAt, scoringConfig: json(config),
      questions: { create: chosen.map((question, index) => ({
        id: randomUUID(), questionId: question.id, position: index + 1,
        snapshot: json({ classLevel: question.classLevel, groupName: question.groupName, subject: question.subject, part: question.part, chapter: question.chapter, topic: question.topic, question: question.questionText, options: question.options, correctOption: question.correctOption, explanation: question.explanation || '', mediaIds: question.mediaIds || [] })
      })) }
    }, include: { questions: { orderBy: { position: 'asc' } } }
  });
  return attemptPayload(created);
}

export async function updateMcqAnswer(actor: Actor, attemptId: string, input: Record<string, unknown>) {
  const db = mcqDatabase();
  const position = Math.floor(Number(input.position));
  if (!Number.isInteger(position) || position < 1) throw new DomainError('প্রশ্নের অবস্থান সঠিক নয়।');
  const attempt = await currentOwnedAttempt(actor.id, attemptId);
  if (attempt.status !== 'IN_PROGRESS') throw new DomainError('পরীক্ষাটি ইতোমধ্যে জমা হয়েছে।', 409);
  if (attempt.expiresAt && attempt.expiresAt <= new Date()) {
    await submitMcqAttempt(actor, attemptId, true);
    throw new DomainError('সময় শেষ হয়েছে; আপনার পরীক্ষা জমা হয়েছে।', 409);
  }
  const question = attempt.questions.find(item => item.position === position);
  if (!question) throw new DomainError('প্রশ্নটি এই পরীক্ষার অংশ নয়।', 404);
  const selected = input.selectedOption === null || input.selectedOption === undefined ? null : Math.floor(Number(input.selectedOption));
  const options = (question.snapshot as any).options as McqOption[];
  if (selected !== null && (!Number.isInteger(selected) || selected < 0 || selected >= options.length)) throw new DomainError('উত্তর বিকল্প সঠিক নয়।');
  const updated = await db.mcqAttemptQuestion.updateMany({
    where: { id: question.id, attemptId, attempt: { is: { studentId: actor.id, status: 'IN_PROGRESS' } } },
    data: { selectedOption: selected, markedForReview: input.markedForReview === true, answeredAt: selected === null ? null : new Date() }
  });
  if (!updated.count) throw new DomainError('উত্তর সংরক্ষণ হয়নি; পরীক্ষার অবস্থা আবার লোড করুন।', 409);
  return { saved: true, position, selectedOption: selected, markedForReview: input.markedForReview === true };
}

export async function submitMcqAttempt(actor: Actor, attemptId: string, automatic = false) {
  const db = mcqDatabase();
  const attempt = await currentOwnedAttempt(actor.id, attemptId);
  if (attempt.status !== 'IN_PROGRESS') return resultPayload(attempt);
  const now = new Date();
  const auto = automatic || Boolean(attempt.expiresAt && attempt.expiresAt <= now);
  const config = attempt.scoringConfig as unknown as ScoringConfig;
  const ordered = [...attempt.questions].sort((a, b) => a.position - b.position);
  const scored = scoreAnswers(ordered.map(item => ({
    answered: item.selectedOption !== null,
    correct: item.selectedOption === (item.snapshot as any).correctOption
  })), config);
  const timeTakenSeconds = Math.max(0, Math.min(Math.floor((now.getTime() - attempt.startedAt.getTime()) / 1000), attempt.durationMinutes === null ? Number.MAX_SAFE_INTEGER : attempt.durationMinutes * 60));
  const isPerfect = scored.correctCount === attempt.questionCount;
  const xpEarned = 20 + scored.correctCount * 2 + (isPerfect ? 20 : 0);
  const status = auto ? 'AUTO_SUBMITTED' : 'SUBMITTED';
  await db.$transaction(async transaction => {
    const claimed = await transaction.mcqExamAttempt.updateMany({
      where: { id: attemptId, studentId: actor.id, status: 'IN_PROGRESS' },
      data: { status, submittedAt: now, score: scored.score, totalScore: scored.totalScore, correctCount: scored.correctCount, wrongCount: scored.wrongCount, unansweredCount: scored.unansweredCount, accuracy: scored.accuracy, timeTakenSeconds, xpEarned }
    });
    if (!claimed.count) return;
    await transaction.mcqAttemptQuestion.updateMany({ where: { attemptId, selectedOption: null }, data: { markedForReview: false } });
  });
  const finalAttempt = await currentOwnedAttempt(actor.id, attemptId);
  return resultPayload(finalAttempt);
}

export async function abandonMcqAttempt(actor: Actor, attemptId: string) {
  const updated = await mcqDatabase().mcqExamAttempt.updateMany({ where: { id: attemptId, studentId: actor.id, status: 'IN_PROGRESS' }, data: { status: 'ABANDONED', submittedAt: new Date() } });
  if (!updated.count) throw new DomainError('অসমাপ্ত পরীক্ষাটি পাওয়া যায়নি।', 404);
  return { abandoned: true };
}

export async function getMcqAttempt(actor: Actor, attemptId: string) {
  const attempt = await currentOwnedAttempt(actor.id, attemptId);
  if (attempt.status === 'IN_PROGRESS') {
    if (attempt.expiresAt && attempt.expiresAt <= new Date()) return submitMcqAttempt(actor, attemptId, true);
    return attemptPayload(attempt);
  }
  return resultPayload(attempt);
}

export async function listMcqHistory(actor: Actor, limit = 30) {
  const rows = await mcqDatabase().mcqExamAttempt.findMany({ where: { studentId: actor.id, status: { in: ['SUBMITTED', 'AUTO_SUBMITTED'] } }, orderBy: { submittedAt: 'desc' }, take: Math.max(1, Math.min(100, limit)), select: { id: true, classLevel: true, groupName: true, subject: true, part: true, chapters: true, questionCount: true, durationMinutes: true, score: true, totalScore: true, correctCount: true, wrongCount: true, unansweredCount: true, accuracy: true, timeTakenSeconds: true, xpEarned: true, submittedAt: true } });
  return rows.map(row => ({ ...row, percentage: row.totalScore ? Math.max(0, row.score / row.totalScore * 100) : 0 }));
}

export async function mcqProfile(actor: Actor) {
  const attempts = await mcqDatabase().mcqExamAttempt.findMany({
    where: { studentId: actor.id, status: { in: ['SUBMITTED', 'AUTO_SUBMITTED'] } },
    orderBy: { submittedAt: 'asc' },
    take: 50_000,
    select: { id: true, classLevel: true, subject: true, part: true, chapters: true, questionCount: true, correctCount: true, wrongCount: true, accuracy: true, score: true, totalScore: true, timeTakenSeconds: true, xpEarned: true, submittedAt: true }
  });
  const stats = deriveGamification(attempts.map(row => ({
    percentage: row.totalScore ? Math.max(0, row.score / row.totalScore * 100) : 0,
    correctCount: row.correctCount, wrongCount: row.wrongCount, questionCount: row.questionCount,
    timeTakenSeconds: row.timeTakenSeconds, xpEarned: row.xpEarned, submittedAt: row.submittedAt || new Date(0), subject: row.subject,
    chapter: Array.isArray(row.chapters) ? String(row.chapters[0] || '') : null
  })));
  const recent = attempts.slice(-10).reverse().map(row => ({ ...row, percentage: row.totalScore ? Math.max(0, row.score / row.totalScore * 100) : 0 }));
  return { ...stats, recentAttempts: recent };
}

export async function toggleMcqBookmark(actor: Actor, questionId: string) {
  const db = mcqDatabase();
  const found = await db.mcqBookmark.findUnique({ where: { studentId_questionId: { studentId: actor.id, questionId } } });
  if (found) {
    await db.mcqBookmark.delete({ where: { id: found.id } });
    return { saved: false };
  }
  const question = await db.mcqQuestion.findFirst({ where: { id: questionId, status: 'PUBLISHED' }, select: { id: true } });
  if (!question) throw new DomainError('প্রশ্নটি পাওয়া যায়নি।', 404);
  await db.mcqBookmark.create({ data: { id: randomUUID(), studentId: actor.id, questionId } });
  return { saved: true };
}

export async function listMcqBookmarks(actor: Actor) {
  const rows = await mcqDatabase().mcqBookmark.findMany({ where: { studentId: actor.id }, orderBy: { createdAt: 'desc' }, include: { question: true }, take: 500 });
  return rows.map(row => ({ id: row.id, createdAt: row.createdAt, question: { id: row.question.id, classLevel: row.question.classLevel, subject: row.question.subject, chapter: row.question.chapter, question: row.question.questionText, options: row.question.options } }));
}

export async function mcqMedia(id: string) {
  const media = await mcqDatabase().mcqMedia.findUnique({ where: { id }, select: { data: true, objectKey: true, mediaType: true } });
  if (!media) throw new DomainError('ছবিটি পাওয়া যায়নি।', 404);
  let data: Buffer | null = media.data ? Buffer.from(media.data) : null;
  if (media.objectKey) {
    try { data = await getMcqMediaObject(media.objectKey); }
    catch { throw new DomainError('ছবির object storage সাময়িকভাবে পাওয়া যাচ্ছে না।', 503); }
  }
  if (!data) throw new DomainError('ছবির storage configuration পাওয়া যায়নি।', 503);
  return { data, mediaType: media.mediaType };
}

export async function uploadMcqBatch(actor: Actor, body: Record<string, any>) {
  const db = mcqDatabase();
  const source = body.source || {};
  const fileHash = value(source.file_hash);
  if (!/^[a-f0-9]{64}$/i.test(fileHash)) throw new DomainError('Source file SHA-256 সঠিক নয়।');
  const sourcePath = value(source.source_path) || value(source.source_filename) || 'unknown';
  const sourceFile = await db.mcqSourceFile.upsert({
    where: { sourcePath_fileHash: { sourcePath, fileHash } },
    create: {
      id: randomUUID(), sourcePath, sourceFilename: value(source.source_filename) || 'unknown',
      fileType: value(source.file_type).toUpperCase(), fileSize: Math.max(0, Number(source.file_size) || 0), fileHash,
      classLevel: nullable(source.class_level), groupName: nullable(source.group_name), subject: nullable(source.subject), part: nullable(source.part), chapter: nullable(source.chapter), topic: nullable(source.topic), processingStatus: 'PROCESSING'
    },
    update: { sourceFilename: value(source.source_filename) || 'unknown', fileType: value(source.file_type).toUpperCase(), fileSize: Math.max(0, Number(source.file_size) || 0), classLevel: nullable(source.class_level), groupName: nullable(source.group_name), subject: nullable(source.subject), part: nullable(source.part), chapter: nullable(source.chapter), topic: nullable(source.topic), processingStatus: 'PROCESSING', processingError: null }
  });
  const mediaInputs = Array.isArray(body.media) ? body.media : [];
  if (process.env.NODE_ENV === 'production' && mediaInputs.length && !mcqObjectStorageConfigured()) throw new DomainError('MCQ image storage is not configured. Set Neon Object Storage credentials before importing media.', 503);
  const preparedMedia = new Map<string, { data: Buffer; mediaType: string; objectKey: string | null; pageNumber: number }>();
  for (const media of mediaInputs) {
    const encoded = value(media.base64);
    if (!encoded || encoded.length > 3_000_000) continue;
    const data = Buffer.from(encoded, 'base64');
    if (data.length > 2_000_000 || !data.length) continue;
    const digest = value(media.sha256) || createHash('sha256').update(data).digest('hex');
    if (!/^[a-f0-9]{64}$/i.test(digest) || createHash('sha256').update(data).digest('hex') !== digest.toLowerCase()) throw new DomainError('MCQ image hash does not match its content.');
    if (!preparedMedia.has(digest)) {
      const mediaType = value(media.mime_type) || 'image/jpeg';
      let objectKey: string | null;
      try { objectKey = await putMcqMediaObject(digest, data, mediaType); }
      catch (error) {
        const nested = error instanceof Error && error.cause instanceof Error ? error.cause : null;
        const nestedCode = nested && 'code' in nested ? String((nested as Error & { code?: unknown }).code || '') : '';
        const detail = error instanceof Error
          ? `${error.name}: ${error.message}${nested ? `; cause ${nested.name}${nestedCode ? ` (${nestedCode})` : ''}: ${nested.message}` : ''}`
          : String(error);
        console.error(`[mcq-media] Neon object storage write failed: ${detail}`);
        throw new DomainError('MCQ image could not be saved to object storage. Check the Neon storage endpoint and credentials, then retry the import batch.', 503);
      }
      preparedMedia.set(digest, { data, mediaType, objectKey, pageNumber: Math.max(0, Math.floor(Number(media.page) || 0)) });
    }
  }
  await db.$transaction(async transaction => {
    const assetIds = new Map<string, string>();
    for (const [digest, prepared] of preparedMedia) {
      const item = await transaction.mcqMedia.upsert({
        where: { sourceFileId_pageNumber_sha256: { sourceFileId: sourceFile.id, pageNumber: prepared.pageNumber, sha256: digest } },
        create: { id: randomUUID(), sourceFileId: sourceFile.id, pageNumber: prepared.pageNumber, mediaType: prepared.mediaType, sha256: digest, data: prepared.objectKey ? null : new Uint8Array(prepared.data), objectKey: prepared.objectKey },
        update: prepared.objectKey ? { objectKey: prepared.objectKey, data: null } : {}
      });
      assetIds.set(digest, item.id);
    }
    for (const sourceIssue of Array.isArray(body.source_issues) ? body.source_issues : []) {
      const problem = value(sourceIssue.problem) || 'Source page could not be read reliably.';
      const rawExtractedText = typeof sourceIssue.raw_text === 'string' ? sourceIssue.raw_text : '';
      const page = sourceIssue.source_page ? Math.max(1, Math.floor(Number(sourceIssue.source_page))) : null;
      const mediaIds = Array.isArray(sourceIssue.media_sha256) ? [...new Set(sourceIssue.media_sha256.map((digest: string) => assetIds.get(digest)).filter(Boolean))] : [];
      const alreadyRecorded = await transaction.mcqImportIssue.findFirst({ where: { sourceFileId: sourceFile.id, candidateIndex: null, page, problem, rawExtractedText }, select: { id: true } });
      if (!alreadyRecorded) await transaction.mcqImportIssue.create({ data: {
        id: randomUUID(), sourceFileId: sourceFile.id, page, rawExtractedText,
        parserInterpretation: json(sourceIssue.interpretation || {}), mediaIds: json(mediaIds), problem,
        suggestedCorrection: value(sourceIssue.suggested_correction) || null
      } });
    }
    let detected = 0, imported = 0, duplicates = 0, rejected = 0, ambiguous = 0;
    const candidates = Array.isArray(body.candidates) ? body.candidates : [];
    for (const candidate of candidates) {
      const candidateIndex = Math.floor(Number(candidate.candidate_index));
      if (!Number.isInteger(candidateIndex) || candidateIndex < 1) continue;
      const prior = await transaction.mcqImportItem.findUnique({ where: { sourceFileId_candidateIndex: { sourceFileId: sourceFile.id, candidateIndex } } });
      if (prior) continue;
      detected++;
      const q = candidate.question;
      const issueInput = candidate.issue;
      const raw = typeof issueInput?.raw_text === 'string' ? issueInput.raw_text : typeof q?.raw_text === 'string' ? q.raw_text : '';
      const options = Array.isArray(q?.options) ? q.options.filter((option: any) => option && typeof option.text === 'string').map((option: any) => ({ label: String(option.label || ''), text: option.text, ...(Array.isArray(option.media_sha256) ? { mediaIds: option.media_sha256.map((digest: string) => assetIds.get(digest)).filter(Boolean) } : {}) })) as McqOption[] : [];
      const correctOption = Number(q?.correct_option);
      const valid = Boolean(q && typeof q.question === 'string' && q.question.trim() && options.length >= 2 && options.length <= 8 && Number.isInteger(correctOption) && correctOption >= 0 && correctOption < options.length && source.class_level && source.subject);
      const candidateHash = sha256(JSON.stringify({ raw: canonical(raw), question: valid ? canonical(q.question) : '', options: valid ? options.map(option => canonical(option.text)) : [] }));
      let outcome = 'REVIEW';
      let questionId: string | null = null;
      let issueId: string | null = null;
      if (valid) {
        const scope = { classLevel: source.class_level, groupName: source.group_name, subject: source.subject, part: source.part, chapter: source.chapter, topic: source.topic };
        const mediaHashes = [...new Set([
          ...(Array.isArray(q.media_sha256) ? q.media_sha256.filter((digest: unknown): digest is string => typeof digest === 'string') : []),
          ...(Array.isArray(q.options) ? q.options.flatMap((option: any) => Array.isArray(option?.media_sha256) ? option.media_sha256.filter((digest: unknown): digest is string => typeof digest === 'string') : []) : [])
        ])].sort();
        const contentHash = questionContentHash(q.question, options, scope);
        const hash = questionHash(q.question, options, scope, mediaHashes);
        const exactQuestion = await transaction.mcqQuestion.findFirst({ where: { questionHash: hash }, select: { id: true, correctOption: true, questionHash: true } });
        const similarQuestion = exactQuestion ?? await transaction.mcqQuestion.findFirst({ where: { contentHash }, select: { id: true, correctOption: true, questionHash: true } });
        if (exactQuestion && exactQuestion.correctOption === correctOption) {
          outcome = 'DUPLICATE';
          questionId = exactQuestion.id;
          duplicates++;
        } else if (similarQuestion) {
          outcome = 'REVIEW';
          ambiguous++;
          const answerConflict = similarQuestion.correctOption !== correctOption;
          const issue = await transaction.mcqImportIssue.create({ data: {
            id: randomUUID(), sourceFileId: sourceFile.id, candidateIndex, page: q.source_page || null, rawExtractedText: raw,
            parserInterpretation: json({ question: q.question, options, answer: correctOption, existingQuestionId: similarQuestion.id, existingCorrectOption: similarQuestion.correctOption, existingQuestionHash: similarQuestion.questionHash, incomingQuestionHash: hash }), mediaIds: json(mediaHashes.map(digest => assetIds.get(digest)).filter(Boolean)),
            problem: answerConflict ? 'একই প্রশ্নের উত্তর key উৎসভেদে আলাদা; স্বয়ংক্রিয়ভাবে duplicate হিসেবে নেওয়া হয়নি।' : 'একই প্রশ্ন ও option আছে, কিন্তু source image/diagram আলাদা; সঠিক mapping যাচাই প্রয়োজন।',
            suggestedCorrection: 'দুই source মিলিয়ে প্রশ্নের ছবি ও সঠিক উত্তর যাচাই করুন।'
          } });
          issueId = issue.id;
        } else {
          const mediaIds = Array.isArray(q.media_sha256) ? q.media_sha256.map((digest: string) => assetIds.get(digest)).filter(Boolean) : [];
          const created = await transaction.mcqQuestion.create({ data: {
            id: randomUUID(), sourceFileId: sourceFile.id, classLevel: value(source.class_level), groupName: nullable(source.group_name), subject: value(source.subject), part: nullable(source.part), chapter: nullable(source.chapter), topic: nullable(source.topic), questionText: q.question, options: json(options), correctOption, explanation: typeof q.explanation === 'string' ? q.explanation : null, difficulty: 'MEDIUM', tags: json([value(source.subject), value(source.chapter)].filter(Boolean)), mediaIds: json(mediaIds), questionHash: hash, contentHash, status: 'PUBLISHED', sourcePage: q.source_page || null, sourceLocation: value(q.source_location) || null
          } });
          outcome = 'IMPORTED';
          questionId = created.id;
          imported++;
        }
      } else if (issueInput) {
        ambiguous++;
        const issue = await transaction.mcqImportIssue.create({ data: {
          id: randomUUID(), sourceFileId: sourceFile.id, candidateIndex, page: issueInput.source_page || null, rawExtractedText: raw,
          parserInterpretation: json(issueInput.interpretation || {}), mediaIds: json(Array.isArray(issueInput.media_sha256) ? [...new Set(issueInput.media_sha256.map((digest: string) => assetIds.get(digest)).filter(Boolean))] : []), problem: value(issueInput.problem) || 'প্রশ্নটি নির্ভরযোগ্যভাবে parse করা যায়নি।', suggestedCorrection: value(issueInput.suggested_correction) || null
        } });
        issueId = issue.id;
      } else {
        rejected++;
        const issue = await transaction.mcqImportIssue.create({ data: {
          id: randomUUID(), sourceFileId: sourceFile.id, candidateIndex, rawExtractedText: raw,
          parserInterpretation: json({ rejectedCandidate: candidate }), problem: 'Importer supplied a malformed question candidate; it was rejected with this audit record.',
          suggestedCorrection: 'মূল ফাইল থেকে question, option ও answer ঠিক করে review queue-তে publish করুন。', status: 'REJECTED', resolvedAt: new Date()
        } });
        issueId = issue.id;
      }
      await transaction.mcqImportItem.create({ data: { id: randomUUID(), sourceFileId: sourceFile.id, candidateIndex, candidateHash, outcome, questionId, issueId } });
    }
    if (detected) await transaction.mcqSourceFile.update({ where: { id: sourceFile.id }, data: { totalDetectedMcqs: { increment: detected }, totalImportedMcqs: { increment: imported }, totalDuplicates: { increment: duplicates }, totalRejected: { increment: rejected }, totalAmbiguous: { increment: ambiguous } } });
  }, { maxWait: 10000, timeout: 30000 });
  return db.mcqSourceFile.findUnique({ where: { id: sourceFile.id }, select: { id: true, fileHash: true, processingStatus: true, totalDetectedMcqs: true, totalImportedMcqs: true, totalDuplicates: true, totalRejected: true, totalAmbiguous: true } });
}

export async function importFailure(actor: Actor, body: Record<string, any>) {
  const source = body.source || {};
  const fileHash = value(source.file_hash);
  if (!/^[a-f0-9]{64}$/i.test(fileHash)) throw new DomainError('Source file SHA-256 সঠিক নয়।');
  const sourcePath = value(source.source_path) || value(source.source_filename) || 'unknown';
  return mcqDatabase().mcqSourceFile.upsert({
    where: { sourcePath_fileHash: { sourcePath, fileHash } },
    create: { id: randomUUID(), sourcePath, sourceFilename: value(source.source_filename) || 'unknown', fileType: value(source.file_type), fileSize: Number(source.file_size) || 0, fileHash, classLevel: nullable(source.class_level), groupName: nullable(source.group_name), subject: nullable(source.subject), part: nullable(source.part), chapter: nullable(source.chapter), topic: nullable(source.topic), processingStatus: 'FAILED', processingError: value(body.error), processedAt: new Date() },
    update: { processingStatus: 'FAILED', processingError: value(body.error), processedAt: new Date() }
  });
}

export async function finalizeMcqImport(actor: Actor, body: Record<string, any>) {
  const db = mcqDatabase();
  const source = await db.mcqSourceFile.findUnique({ where: { sourcePath_fileHash: { sourcePath: value(body.source_path) || 'unknown', fileHash: value(body.file_hash) } } });
  if (!source) throw new DomainError('Import source পাওয়া যায়নি।', 404);
  const [groups, openIssues] = await Promise.all([
    db.mcqImportItem.groupBy({ by: ['outcome'], where: { sourceFileId: source.id }, _count: { _all: true } }),
    db.mcqImportIssue.count({ where: { sourceFileId: source.id, status: 'OPEN' } })
  ]);
  const counts = Object.fromEntries(groups.map(group => [group.outcome, group._count._all]));
  const detected = groups.reduce((sum, group) => sum + group._count._all, 0);
  const imported = Number(counts.IMPORTED || 0), duplicates = Number(counts.DUPLICATE || 0), rejected = Number(counts.REJECTED || 0), ambiguous = Number(counts.REVIEW || 0);
  const reconcile = detected === imported + duplicates + rejected + ambiguous;
  const sourceIssue = Boolean(body.processing_status === 'REVIEW_REQUIRED');
  const status = source.processingStatus === 'FAILED' ? 'FAILED' : !detected && (sourceIssue || openIssues) ? 'REVIEW_REQUIRED' : !detected ? 'NO_MCQS' : ambiguous || rejected || openIssues || sourceIssue || !reconcile ? 'REVIEW_REQUIRED' : 'COMPLETED';
  return db.mcqSourceFile.update({ where: { id: source.id }, data: { totalDetectedMcqs: detected, totalImportedMcqs: imported, totalDuplicates: duplicates, totalRejected: rejected, totalAmbiguous: ambiguous, processingStatus: status, processedAt: new Date() } });
}

export async function adminMcqSources(input: Record<string, unknown>) {
  const db = mcqDatabase();
  const page = Math.max(1, Math.floor(Number(input.page) || 1));
  const take = Math.max(1, Math.min(100, Math.floor(Number(input.take) || 30)));
  const status = value(input.status);
  const where: Prisma.McqSourceFileWhereInput = status ? { processingStatus: status } : {};
  const [items, total] = await Promise.all([db.mcqSourceFile.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * take, take }), db.mcqSourceFile.count({ where })]);
  return { items, total, page, take };
}

export async function adminMcqSummary() {
  const db = mcqDatabase();
  const [fileCount, questionCount, publishedCount, issueCount, totals, fileStatuses] = await Promise.all([
    db.mcqSourceFile.count(),
    db.mcqQuestion.count(),
    db.mcqQuestion.count({ where: { status: 'PUBLISHED' } }),
    db.mcqImportIssue.count({ where: { status: 'OPEN' } }),
    db.mcqSourceFile.aggregate({ _sum: { totalDetectedMcqs: true, totalImportedMcqs: true, totalDuplicates: true, totalRejected: true, totalAmbiguous: true } }),
    db.mcqSourceFile.groupBy({ by: ['processingStatus'], _count: { _all: true } })
  ]);
  return {
    filesDiscovered: fileCount,
    filesProcessed: fileStatuses.filter(row => ['COMPLETED', 'REVIEW_REQUIRED', 'NO_MCQS'].includes(row.processingStatus)).reduce((sum, row) => sum + row._count._all, 0),
    filesFailed: fileStatuses.filter(row => row.processingStatus === 'FAILED').reduce((sum, row) => sum + row._count._all, 0),
    filesReview: fileStatuses.filter(row => row.processingStatus === 'REVIEW_REQUIRED').reduce((sum, row) => sum + row._count._all, 0),
    questions: questionCount,
    publishedQuestions: publishedCount,
    openIssues: issueCount,
    detected: totals._sum.totalDetectedMcqs || 0,
    imported: totals._sum.totalImportedMcqs || 0,
    duplicates: totals._sum.totalDuplicates || 0,
    rejected: totals._sum.totalRejected || 0,
    needsReview: totals._sum.totalAmbiguous || 0
  };
}

export async function adminMcqIssues(input: Record<string, unknown>) {
  const db = mcqDatabase();
  const page = Math.max(1, Math.floor(Number(input.page) || 1));
  const take = Math.max(1, Math.min(100, Math.floor(Number(input.take) || 50)));
  const status = value(input.status) || 'OPEN';
  const [items, total] = await Promise.all([db.mcqImportIssue.findMany({ where: { status }, include: { sourceFile: { select: { sourceFilename: true, sourcePath: true, classLevel: true, subject: true, part: true, chapter: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * take, take }), db.mcqImportIssue.count({ where: { status } })]);
  return { items, total, page, take };
}

export async function resolveMcqIssue(actor: Actor, issueId: string, input: Record<string, any>) {
  const db = mcqDatabase();
  const issue = await db.mcqImportIssue.findUnique({ where: { id: issueId }, include: { sourceFile: true } });
  if (!issue || issue.status !== 'OPEN') throw new DomainError('এই review item আর খোলা নেই।', 404);
  const action = value(input.action).toUpperCase();
  if (action === 'REJECT') {
    await db.$transaction(async transaction => {
      await transaction.mcqImportIssue.update({ where: { id: issue.id }, data: { status: 'REJECTED', resolvedAt: new Date() } });
      if (issue.candidateIndex) {
        await transaction.mcqImportItem.updateMany({ where: { sourceFileId: issue.sourceFileId, candidateIndex: issue.candidateIndex, outcome: 'REVIEW' }, data: { outcome: 'REJECTED' } });
        await transaction.mcqSourceFile.update({ where: { id: issue.sourceFileId }, data: { totalAmbiguous: { decrement: 1 }, totalRejected: { increment: 1 } } });
      }
    });
    return { resolved: true, action };
  }
  if (!issue.candidateIndex) throw new DomainError('এইটি নির্দিষ্ট MCQ candidate নয়, source/page issue। মূল page ঠিক করে আবার import করুন; source issue-কে question হিসেবে গণনা করা যাবে না।');
  const question = input.question;
  const options: McqOption[] = Array.isArray(question?.options) ? question.options.filter((item: any) => item && typeof item.text === 'string').map((item: any) => ({ label: String(item.label || ''), text: item.text })) : [];
  const correctOption = Number(question?.correctOption);
  if (action !== 'PUBLISH' || typeof question?.question !== 'string' || !question.question.trim() || options.length < 2 || !Number.isInteger(correctOption) || correctOption < 0 || correctOption >= options.length) throw new DomainError('Question text, options ও correct answer সঠিকভাবে দিন।');
  const scope = { classLevel: issue.sourceFile.classLevel, groupName: issue.sourceFile.groupName, subject: issue.sourceFile.subject, part: issue.sourceFile.part, chapter: issue.sourceFile.chapter, topic: issue.sourceFile.topic };
  const contentHash = questionContentHash(question.question, options, scope);
  const hash = questionHash(question.question, options, scope);
  const exists = await db.mcqQuestion.findFirst({ where: { OR: [{ questionHash: hash }, { contentHash }] }, select: { id: true, correctOption: true } });
  if (exists) throw new DomainError('একই প্রশ্ন বা ভিন্ন source image-সহ একই text question ইতোমধ্যে আছে; আগে duplicate/conflict যাচাই করুন।', 409);
  const created = await db.$transaction(async transaction => {
    const row = await transaction.mcqQuestion.create({ data: {
      id: randomUUID(), sourceFileId: issue.sourceFileId, classLevel: issue.sourceFile.classLevel || value(question.classLevel) || 'Unknown', groupName: issue.sourceFile.groupName,
      subject: issue.sourceFile.subject || value(question.subject) || 'Unknown', part: issue.sourceFile.part, chapter: issue.sourceFile.chapter, topic: issue.sourceFile.topic,
      questionText: question.question, options: json(options), correctOption, explanation: value(question.explanation) || null,
      difficulty: value(question.difficulty) || 'MEDIUM', tags: json([issue.sourceFile.subject, issue.sourceFile.chapter].filter(Boolean)), mediaIds: json(issue.mediaIds || []), questionHash: hash, contentHash,
      status: 'PUBLISHED', sourcePage: issue.page, sourceLocation: issue.page ? `পৃষ্ঠা ${issue.page}` : null
    } });
    await transaction.mcqImportIssue.update({ where: { id: issue.id }, data: { status: 'FIXED', resolvedAt: new Date() } });
    if (issue.candidateIndex) {
      await transaction.mcqImportItem.updateMany({ where: { sourceFileId: issue.sourceFileId, candidateIndex: issue.candidateIndex, outcome: 'REVIEW' }, data: { outcome: 'IMPORTED', questionId: row.id } });
      await transaction.mcqSourceFile.update({ where: { id: issue.sourceFileId }, data: { totalAmbiguous: { decrement: 1 }, totalImportedMcqs: { increment: 1 } } });
    }
    return row;
  });
  return { resolved: true, action, questionId: created.id };
}

export async function adminMcqQuestions(input: Record<string, unknown>) {
  const db = mcqDatabase();
  const page = Math.max(1, Math.floor(Number(input.page) || 1));
  const take = Math.max(1, Math.min(100, Math.floor(Number(input.take) || 50)));
  const q = value(input.q);
  const where: Prisma.McqQuestionWhereInput = {
    ...(value(input.classLevel) ? { classLevel: value(input.classLevel) } : {}),
    ...(value(input.subject) ? { subject: value(input.subject) } : {}),
    ...(value(input.status) ? { status: value(input.status) } : {}),
    ...(q ? { questionText: { contains: q, mode: 'insensitive' } } : {})
  };
  const [items, total] = await Promise.all([db.mcqQuestion.findMany({ where, include: { sourceFile: { select: { sourceFilename: true, sourcePath: true, fileHash: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * take, take }), db.mcqQuestion.count({ where })]);
  return { items, total, page, take };
}

export async function setMcqQuestionStatus(actor: Actor, questionId: string, status: string) {
  if (!['PUBLISHED', 'REVIEW', 'REJECTED'].includes(status)) throw new DomainError('Question status সঠিক নয়।');
  return mcqDatabase().mcqQuestion.update({ where: { id: questionId }, data: { status } });
}

export async function autoSubmitExpiredMcqAttempts() {
  if (!process.env.DATABASE_URL) return 0;
  const db = mcqDatabase();
  const expired = await db.mcqExamAttempt.findMany({ where: { status: 'IN_PROGRESS', expiresAt: { lte: new Date() } }, select: { id: true, studentId: true }, take: 100 });
  let count = 0;
  for (const attempt of expired) {
    try {
      await submitMcqAttempt({ id: attempt.studentId, role: 'STUDENT' }, attempt.id, true);
      count++;
    } catch { /* A simultaneous manual submit is idempotent; the next sweep handles transient errors. */ }
  }
  return count;
}
