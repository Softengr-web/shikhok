import { id } from './seed.js';
import { DomainError, requireRole } from './services.js';
import type { AppState, Gig, GigDraft, GigDraftPackage, User } from './types.js';

const now = () => new Date().toISOString();
const arrayOf = (value: unknown) => Array.isArray(value) ? value : [];

export const emptyGigDraft = (teacherId: string): GigDraft => ({
  id: id('gig-draft'), teacherId, step: 1, status: 'DRAFT', updatedAt: now(),
  title: '', description: '', subject: '', topic: '', subtopic: '', tags: [], levels: ['HSC'],
  outcomes: [''], teachingStyle: 'উদাহরণভিত্তিক', classType: 'লাইভ ১:১', duration: 60,
  pricingModel: 'PACKAGE', packages: [{ id: id('package'), name: 'বেসিক', classes: 1, duration: 60, price: 500, discount: 0, validity: 30, capacity: 1, features: ['লাইভ ক্লাস'], policy: '' }],
  extras: [], trial: { enabled: true, paid: false, price: 0, duration: 20 }, demoUrl: '', media: [],
  requirements: [{ id: id('requirement'), label: 'শিক্ষার্থী কী শিখতে চান তা লিখুন', required: true, file: false }],
  includes: ['লাইভ ক্লাস', 'ক্লাস নোট'], faqs: [], availability: { শনি: ['১৬:০০'], রবি: ['১৬:০০'] },
  deliveryMode: 'অনলাইন', cancellation: 'ক্লাসের ২৪ ঘণ্টা আগে বাতিল করা যাবে।', reschedule: 'একবার সময় পরিবর্তন করা যাবে।',
  visibility: 'PUBLIC', qualityScore: 0, version: 1,
});

const quality = (draft: GigDraft) => {
  let score = 0;
  if (draft.title.length >= 12) score += 12;
  if (draft.description.length >= 80) score += 12;
  if (draft.subject && draft.topic) score += 10;
  if (draft.outcomes.filter(Boolean).length >= 2) score += 10;
  if (draft.levels.length) score += 6;
  if (draft.packages.length && draft.packages.every(p => p.price >= 0 && p.classes > 0)) score += 14;
  if (draft.demoUrl || draft.media.length) score += 10;
  if (draft.requirements.length) score += 7;
  if (draft.includes.length >= 2) score += 7;
  if (draft.faqs.length >= 2) score += 5;
  if (Object.keys(draft.availability).length) score += 7;
  return score;
};

export function getGigDraft(state: AppState, actor: User, draftId?: string) {
  requireRole(actor, ['TEACHER']);
  const drafts = state.gigDrafts ?? (state.gigDrafts = []);
  const teacherId = state.teachers.find(t => t.userId === actor.id)?.id ?? actor.id;
  const found = drafts.find(d => d.teacherId === teacherId && (!draftId || d.id === draftId));
  return found ?? emptyGigDraft(teacherId);
}

export function saveGigDraft(state: AppState, actor: User, input: Record<string, unknown>) {
  requireRole(actor, ['TEACHER']);
  const drafts = state.gigDrafts ?? (state.gigDrafts = []);
  const teacher = state.teachers.find(t => t.userId === actor.id);
  if (!teacher) throw new DomainError('শিক্ষক প্রোফাইল পাওয়া যায়নি।', 404);
  const requestedId = typeof input.id === 'string' ? input.id : '';
  const existing = drafts.find(d => d.teacherId === teacher.id && d.id === requestedId);
  const base = existing ?? emptyGigDraft(teacher.id);
  const next = { ...base, ...input, teacherId: teacher.id, id: base.id, status: 'DRAFT' as const, updatedAt: now(), version: base.version + (existing ? 1 : 0) } as GigDraft;
  next.packages = arrayOf(next.packages).map((p: any): GigDraftPackage => ({ ...p, id: p.id || id('package'), classes: Number(p.classes) || 1, duration: Number(p.duration) || 60, price: Number(p.price) || 0, discount: Number(p.discount) || 0, validity: Number(p.validity) || 30, capacity: Number(p.capacity) || 1, features: arrayOf(p.features).map(String) }));
  next.qualityScore = quality(next);
  if (existing) drafts[drafts.indexOf(existing)] = next; else drafts.push(next);
  return next;
}

export function publishGigDraft(state: AppState, actor: User, draftId: string) {
  const draft = getGigDraft(state, actor, draftId);
  draft.qualityScore = quality(draft);
  if (draft.qualityScore < 70) throw new DomainError(`প্রকাশের আগে গিগের মান অন্তত ৭০ হতে হবে। বর্তমান স্কোর ${draft.qualityScore}।`);
  if (!draft.title || !draft.description || !draft.subject || !draft.topic) throw new DomainError('পরিচিতি, বিষয়, টপিক ও বর্ণনা সম্পূর্ণ করুন।');
  const gig: Gig = { id: id('gig'), teacherId: draft.teacherId, title: draft.title, description: draft.description, subject: draft.subject, topic: draft.topic, level: draft.levels.join(', '), language: 'বাংলা', tags: draft.tags, demoUrl: draft.demoUrl, includes: draft.includes, requirements: draft.requirements.map(r => r.label).join('\n'), faqs: draft.faqs.map(f => ({ q: f.q, a: f.a })), active: true, createdAt: now(), subtopic: draft.subtopic, levels: draft.levels, outcomes: draft.outcomes, teachingStyle: draft.teachingStyle, classType: draft.classType, duration: draft.duration, pricingModel: draft.pricingModel, extras: draft.extras, trial: draft.trial, media: draft.media, availability: draft.availability, cancellation: draft.cancellation, reschedule: draft.reschedule, visibility: draft.visibility, moderationStatus: 'PENDING', version: draft.version, badges: draft.qualityScore >= 90 ? ['জনপ্রিয় পছন্দ'] : draft.trial.enabled ? ['ট্রায়াল আছে'] : [], discount: Math.max(...draft.packages.map(p => p.discount), 0), packages: draft.packages.map(p => ({ id: p.id, name: p.name, classes: p.classes, duration: p.duration, price: Math.max(0, Math.round(p.price * (1 - p.discount / 100))), features: p.features })) };
  state.gigs.push(gig);
  (state.gigVersions ??= []).push({ id: id('gig-version'), gigId: gig.id, version: 1, snapshot: gig as unknown as Record<string, unknown>, createdAt: now() });
  (state.gigModeration ??= []).push({ gigId: gig.id, status: 'PENDING', note: 'প্রকাশের পর মডারেশনের অপেক্ষায়', updatedAt: now() });
  (state.gigAnalytics ??= []).push({ gigId: gig.id, views: 0, favorites: 0, bookings: 0, revenue: 0, conversion: 0, averageRating: 0 });
  draft.status = 'PUBLISHED';
  draft.updatedAt = now();
  return { gig, draft };
}
