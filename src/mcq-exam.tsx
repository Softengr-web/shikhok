import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, post } from './api';
import { Avatar, Empty, Loading, bn, go, shortDate } from './components';

type Catalog = { classes: string[]; groups: string[]; subjects: string[]; parts: string[]; chapters: string[]; availableCount: number };
type Choice = { label: string; text: string; mediaIds?: string[] };
type ExamQuestion = { position: number; questionId: string | null; question: string; options: Choice[]; chapter: string | null; topic: string | null; mediaIds: string[]; selectedOption: number | null; markedForReview: boolean };
type ActiveAttempt = { id: string; status: string; classLevel: string; groupName: string | null; subject: string; part: string | null; chapters: string[]; questionCount: number; durationMinutes: number | null; startedAt: string; expiresAt: string | null; questions: ExamQuestion[] };
type ReviewItem = { position: number; questionId: string | null; question: string; options: Choice[]; mediaIds: string[]; selectedOption: number | null; correctOption: number; selectedIsCorrect: boolean; explanation: string; chapter: string | null };
type ExamResult = { id: string; status: string; score: number; totalScore: number; percentage: number; correctCount: number; wrongCount: number; unansweredCount: number; accuracy: number; timeTakenSeconds: number; durationMinutes: number | null; xpEarned: number; submittedAt: string; classLevel: string; groupName: string | null; subject: string; part: string | null; chapters: string[]; questionCount: number; review: ReviewItem[]; nextSteps: string[] };
type ProfileStats = { totalExams: number; totalQuestions: number; totalAttempted: number; totalCorrect: number; accuracy: number; bestScore: number; averageScore: number; currentStreak: number; longestStreak: number; studyTimeSeconds: number; xp: number; level: number; badges: string[]; recentAttempts: Array<{ id: string; subject: string; questionCount: number; correctCount: number; percentage: number; submittedAt: string }> };
type SourcePage = { items: any[]; total: number };
type IssuePage = { items: any[]; total: number };
type PendingAnswerSave = { attemptId: string; position: number; selectedOption: number | null; markedForReview: boolean };
const EMPTY_CATALOG: Catalog = { classes: [], groups: [], subjects: [], parts: [], chapters: [], availableCount: 0 };
const choiceLabel = (index: number) => ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ'][index] || String(index + 1);
const savedKey = (id: string) => `mcq-attempt-${id}`;
const formatDuration = (seconds: number) => `${bn(Math.floor(seconds / 60))} মি ${bn(seconds % 60)} সে`;

export function McqExamPage() {
  const [catalog, setCatalog] = useState<Catalog>(EMPTY_CATALOG);
  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [catalogRefreshing, setCatalogRefreshing] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [filters, setFilters] = useState({ classLevel: '', groupName: '', subject: '', part: '', chapters: [] as string[] });
  const [chapterSearch, setChapterSearch] = useState('');
  const [questionCount, setQuestionCount] = useState(20);
  const [duration, setDuration] = useState(20);
  const [mode, setMode] = useState('STANDARD');
  const [active, setActive] = useState<ActiveAttempt | null>(null);
  const [attempt, setAttempt] = useState<ActiveAttempt | null>(null);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [marked, setMarked] = useState<Record<number, boolean>>({});
  const [current, setCurrent] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'offline' | 'error'>('saved');
  const pendingSaves = useRef(new Map<string, PendingAnswerSave>());
  const saveFlush = useRef<Promise<void> | null>(null);
  const submitLock = useRef(false);
  const autoSubmitTried = useRef<string | null>(null);
  const questionCardRef = useRef<HTMLElement | null>(null);
  const questionHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const shouldFocusQuestion = useRef(false);

  const flushPendingSaves = useCallback(async () => {
    if (saveFlush.current) return saveFlush.current;
    const flush = (async () => {
      while (pendingSaves.current.size) {
        if (!navigator.onLine) throw new Error('ইন্টারনেট সংযোগ নেই। উত্তর এই ডিভাইসে রাখা হয়েছে।');
        const [key, answer] = pendingSaves.current.entries().next().value as [string, PendingAnswerSave];
        await post(`/mcq/attempts/${answer.attemptId}/answer`, { position: answer.position, selectedOption: answer.selectedOption, markedForReview: answer.markedForReview });
        if (pendingSaves.current.get(key) === answer) pendingSaves.current.delete(key);
      }
    })();
    saveFlush.current = flush;
    try {
      await flush;
      setSaveError('');
      setSaveState(pendingSaves.current.size ? 'saving' : 'saved');
    } catch (reason) {
      setSaveState(navigator.onLine ? 'error' : 'offline');
      throw reason;
    } finally { saveFlush.current = null; }
  }, []);

  const queueAnswerSave = useCallback((attemptId: string, position: number, selectedOption: number | null, markedForReview: boolean, message: string) => {
    const key = `${attemptId}:${position}`;
    pendingSaves.current.set(key, { attemptId, position, selectedOption, markedForReview });
    setSaveState(navigator.onLine ? 'saving' : 'offline');
    setSaveError(navigator.onLine ? '' : message);
    if (navigator.onLine) void flushPendingSaves().catch(() => setSaveError(message));
  }, [flushPendingSaves]);

  const catalogUrl = useMemo(() => {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (Array.isArray(value)) value.forEach(item => query.append(key, item));
      else if (value) query.set(key, String(value));
    });
    if (mode !== 'STANDARD') query.set('mode', mode);
    return `/mcq/catalog${query.size ? `?${query}` : ''}`;
  }, [filters, mode]);
  const chapterMatches = useMemo(() => {
    const query = chapterSearch.trim().toLocaleLowerCase();
    const matches = catalog.chapters.filter(chapter => !query || chapter.toLocaleLowerCase().includes(query));
    return matches.slice(0, query ? 60 : 12);
  }, [catalog.chapters, chapterSearch]);
  const maxQuestionCount = Math.max(1, Math.min(100, catalog.availableCount || 100));

  const navigateToQuestion = (index: number) => {
    const destination = Math.max(0, Math.min(attempt?.questionCount ? attempt.questionCount - 1 : 0, index));
    shouldFocusQuestion.current = true;
    setCurrent(destination);
    if (attempt) persistLocal(attempt.id, answers, marked, destination);
  };
  const toggleChapter = (chapter: string) => setFilters(previous => ({
    ...previous,
    chapters: previous.chapters.includes(chapter) ? previous.chapters.filter(item => item !== chapter) : [...previous.chapters, chapter]
  }));

  const applyActiveLookup = useCallback((lookup: ActiveAttempt | ExamResult | null) => {
    if (lookup && lookup.status !== 'IN_PROGRESS') { setResult(lookup as ExamResult); setActive(null); }
    else { setActive(lookup as ActiveAttempt | null); setResult(null); }
  }, []);

  const loadActive = useCallback(async () => {
    try { applyActiveLookup(await api<ActiveAttempt | ExamResult | null>('/mcq/attempts/active')); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'পরীক্ষার তথ্য লোড করা যায়নি।'); }
  }, [applyActiveLookup]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [catalogResult, activeResult] = await Promise.allSettled([api<Catalog>('/mcq/catalog'), api<ActiveAttempt | ExamResult | null>('/mcq/attempts/active')]);
      if (cancelled) return;
      if (catalogResult.status === 'fulfilled') {
        setCatalog(catalogResult.value); setCatalogLoaded(true);
        setClassOptions(catalogResult.value.classes);
      } else setError(catalogResult.reason instanceof Error ? catalogResult.reason.message : 'প্রশ্ন ব্যাংক লোড করা যায়নি।');
      if (activeResult.status === 'fulfilled') applyActiveLookup(activeResult.value);
      else setError(activeResult.reason instanceof Error ? activeResult.reason.message : 'অসমাপ্ত পরীক্ষার তথ্য লোড করা যায়নি।');
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [applyActiveLookup]);

  useEffect(() => {
    if (!catalogLoaded) return;
    let cancelled = false;
    setCatalogRefreshing(true); setCatalogError('');
    void api<Catalog>(catalogUrl).then(data => { if (!cancelled) setCatalog(data); }).catch(reason => {
      if (!cancelled) setCatalogError(reason instanceof Error ? reason.message : 'এই বাছাইয়ের প্রশ্ন খুঁজে পাওয়া যায়নি।');
    }).finally(() => { if (!cancelled) setCatalogRefreshing(false); });
    return () => { cancelled = true; };
  }, [catalogLoaded, catalogUrl]);

  useEffect(() => {
    if (catalog.availableCount < 1) return;
    const limit = Math.min(100, catalog.availableCount);
    setQuestionCount(value => Math.min(value, limit));
  }, [catalog.availableCount]);

  useEffect(() => {
    const retrySaves = () => { void flushPendingSaves().catch(() => setSaveError('কিছু উত্তর এখনো সার্ভারে যায়নি—আবার পাঠানোর চেষ্টা করুন।')); };
    const refreshTimer = () => { if (document.visibilityState === 'visible') { setNow(Date.now()); retrySaves(); } };
    window.addEventListener('online', retrySaves);
    document.addEventListener('visibilitychange', refreshTimer);
    return () => { window.removeEventListener('online', retrySaves); document.removeEventListener('visibilitychange', refreshTimer); };
  }, [flushPendingSaves]);

  useEffect(() => {
    if (!shouldFocusQuestion.current) return;
    shouldFocusQuestion.current = false;
    questionHeadingRef.current?.focus({ preventScroll: true });
    if (window.matchMedia('(max-width: 680px)').matches) questionCardRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }, [current]);

  useEffect(() => {
    if (!attempt || result) return;
    const timer = attempt.expiresAt ? window.setInterval(() => setNow(Date.now()), 1000) : undefined;
    const preventExit = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', preventExit);
    return () => { if (timer) window.clearInterval(timer); window.removeEventListener('beforeunload', preventExit); };
  }, [attempt, result]);

  const startAttempt = async (settings: { classLevel: string; groupName: string; subject: string; part: string; chapters: string[]; questionCount: number; durationMinutes: number; mode: string }) => {
    setBusy(true); setError('');
    try {
      const created = await post<ActiveAttempt>('/mcq/attempts', settings);
      pendingSaves.current.clear(); setSaveError(''); setSaveState('saved'); autoSubmitTried.current = null;
      setActive(null); setAttempt(created); setResult(null); setCurrent(0);
      const local = readSaved(created.id);
      const serverAnswers: Record<number, number> = {};
      const serverMarked: Record<number, boolean> = {};
      for (const question of created.questions) {
        if (question.selectedOption !== null) serverAnswers[question.position] = question.selectedOption;
        if (question.markedForReview) serverMarked[question.position] = true;
      }
      const nextAnswers = local && local.answers ? { ...serverAnswers, ...local.answers } : serverAnswers;
      const nextMarked = local && local.marked ? { ...serverMarked, ...local.marked } : serverMarked;
      setAnswers(nextAnswers); setMarked(nextMarked); persistLocal(created.id, nextAnswers, nextMarked);
      for (const question of created.questions) {
        if (nextAnswers[question.position] !== serverAnswers[question.position] || nextMarked[question.position] !== serverMarked[question.position]) {
          queueAnswerSave(created.id, question.position, nextAnswers[question.position] ?? null, nextMarked[question.position] === true, 'কিছু উত্তর সার্ভারে পৌঁছায়নি; সংযোগ ফিরলে আবার চেষ্টা করুন।');
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'পরীক্ষা শুরু করা যায়নি।');
      if (reason instanceof Error && reason.message.includes('অসমাপ্ত')) void loadActive();
    } finally { setBusy(false); }
  };

  const readSaved = (id: string): { answers?: Record<number, number>; marked?: Record<number, boolean>; current?: number } | null => {
    try { const raw = localStorage.getItem(savedKey(id)); return raw ? JSON.parse(raw) : null; } catch { return null; }
  };
  const persistLocal = (id: string, nextAnswers: Record<number, number>, nextMarked: Record<number, boolean>, savedCurrent = current) => {
    try { localStorage.setItem(savedKey(id), JSON.stringify({ answers: nextAnswers, marked: nextMarked, current: savedCurrent, savedAt: new Date().toISOString() })); } catch { /* Server autosave remains authoritative if browser storage is unavailable. */ }
  };

  const resumeAttempt = async () => {
    if (!active) return;
    setBusy(true); setError('');
    try {
      const resumed = await api<ActiveAttempt | ExamResult>(`/mcq/attempts/${active.id}`);
      if (resumed.status === 'IN_PROGRESS') {
        const live = resumed as ActiveAttempt;
        const local = readSaved(live.id);
        pendingSaves.current.clear(); setSaveError(''); setSaveState('saved'); autoSubmitTried.current = null;
        setAttempt(live); setActive(null); setCurrent(Math.max(0, Math.min(live.questionCount - 1, local?.current ?? 0)));
        const serverAnswers: Record<number, number> = {};
        const serverMarked: Record<number, boolean> = {};
        live.questions.forEach(question => { if (question.selectedOption !== null) serverAnswers[question.position] = question.selectedOption; if (question.markedForReview) serverMarked[question.position] = true; });
        const nextAnswers = local?.answers ? { ...serverAnswers, ...local.answers } : serverAnswers;
        const nextMarked = local?.marked ? { ...serverMarked, ...local.marked } : serverMarked;
        setAnswers(nextAnswers); setMarked(nextMarked); persistLocal(live.id, nextAnswers, nextMarked);
        live.questions.forEach(question => { if (nextAnswers[question.position] !== serverAnswers[question.position] || nextMarked[question.position] !== serverMarked[question.position]) queueAnswerSave(live.id, question.position, nextAnswers[question.position] ?? null, nextMarked[question.position] === true, 'অফলাইনে থাকা উত্তরগুলো সংরক্ষণ করা যাচ্ছে না।'); });
      } else { setResult(resumed as ExamResult); setActive(null); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'অসমাপ্ত পরীক্ষা খোলা যায়নি।'); }
    finally { setBusy(false); }
  };

  const changeAnswer = (question: ExamQuestion, selectedOption: number | null) => {
    if (!attempt) return;
    const next = { ...answers };
    if (selectedOption === null) delete next[question.position]; else next[question.position] = selectedOption;
    setAnswers(next); persistLocal(attempt.id, next, marked); setSaveError('');
    queueAnswerSave(attempt.id, question.position, selectedOption, marked[question.position] === true, 'উত্তরটি এখনো server-এ সংরক্ষিত হয়নি। নেটওয়ার্ক ফিরলে আবার নির্বাচন করুন।');
  };

  const toggleReview = (question: ExamQuestion) => {
    if (!attempt) return;
    const next = { ...marked, [question.position]: !marked[question.position] };
    setMarked(next); persistLocal(attempt.id, answers, next);
    queueAnswerSave(attempt.id, question.position, answers[question.position] ?? null, next[question.position], 'Review marker server-এ সংরক্ষণ হয়নি।');
  };

  const submit = useCallback(async () => {
    if (!attempt || busy || submitLock.current) return;
    submitLock.current = true;
    setBusy(true); setError('');
    try {
      const expired = Boolean(attempt.expiresAt && Date.parse(attempt.expiresAt) <= Date.now());
      try { await flushPendingSaves(); }
      catch (reason) {
        if (!expired) throw new Error('সব উত্তর সার্ভারে সংরক্ষিত হয়নি। সংযোগ ফিরিয়ে আবার জমা দিন।');
      }
      const submitted = await post<ExamResult>(`/mcq/attempts/${attempt.id}/submit`, {});
      for (const [key, answer] of pendingSaves.current) if (answer.attemptId === attempt.id) pendingSaves.current.delete(key);
      setSaveError(''); setSaveState('saved'); setResult(submitted); setAttempt(null); setConfirmSubmit(false); localStorage.removeItem(savedKey(attempt.id));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'পরীক্ষা জমা দেওয়া যায়নি।'); }
    finally { submitLock.current = false; setBusy(false); }
  }, [attempt, busy, flushPendingSaves]);

  const secondsLeft = attempt?.expiresAt ? Math.max(0, Math.ceil((new Date(attempt.expiresAt).getTime() - now) / 1000)) : null;
  useEffect(() => {
    if (!attempt || result || secondsLeft !== 0 || busy || autoSubmitTried.current === attempt.id) return;
    autoSubmitTried.current = attempt.id;
    void submit();
  }, [attempt, result, secondsLeft, busy, submit]);
  useEffect(() => {
    const retryExpiredSubmit = () => {
      setNow(Date.now());
      if (attempt?.expiresAt && Date.parse(attempt.expiresAt) <= Date.now()) void submit();
    };
    window.addEventListener('online', retryExpiredSubmit);
    return () => window.removeEventListener('online', retryExpiredSubmit);
  }, [attempt, submit]);
  if (loading) return <section className="page section"><Loading /></section>;

  if (result) return <ResultView result={result} onRetryMistakes={() => { setResult(null); setMode('MISTAKES'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} onNewExam={() => { setResult(null); void loadActive(); }} />;
  if (attempt) {
    const question = attempt.questions[current];
    const answered = attempt.questions.reduce((total, item) => total + (answers[item.position] !== undefined ? 1 : 0), 0);
    const timerLabel = secondsLeft === null ? 'সময় গণনা বন্ধ' : secondsLeft === 0 ? 'সময় শেষ' : secondsLeft <= 60 ? 'শেষ ১ মিনিট' : secondsLeft <= 300 ? '৫ মিনিটের কম বাকি' : secondsLeft <= 600 ? '১০ মিনিটের কম বাকি' : 'বাকি সময়';
    const timerAnnouncement = secondsLeft === 600 ? '১০ মিনিট বাকি।' : secondsLeft === 300 ? '৫ মিনিট বাকি।' : secondsLeft === 60 ? '১ মিনিট বাকি।' : secondsLeft === 0 ? 'সময় শেষ। পরীক্ষা জমা হচ্ছে।' : '';
    const saveLabel = saveState === 'saving' ? 'উত্তর সংরক্ষণ হচ্ছে…' : saveState === 'offline' ? 'অফলাইন · এই ডিভাইসে রাখা আছে' : saveState === 'error' ? 'সার্ভারে সংরক্ষণ হয়নি' : 'সব উত্তর সংরক্ষিত';
    return <section className="mcq-page page section mcq-active">
      <header className="mcq-exam-top"><div><p className="eyebrow">{attempt.classLevel}{attempt.groupName ? ` · ${attempt.groupName}` : ''} · {attempt.subject}</p><h1>পরীক্ষা</h1><p>{attempt.part || 'সব অংশ'}{attempt.chapters.length ? ` · ${attempt.chapters.join(', ')}` : ''}</p></div><div className={`mcq-clock${secondsLeft !== null && secondsLeft < 60 ? ' is-urgent' : ''}`} role="timer" aria-label={secondsLeft === null ? 'সময় গণনা নেই' : `${timerLabel}: ${Math.floor(secondsLeft / 60)} মিনিট ${secondsLeft % 60} সেকেন্ড`}><small>{timerLabel}</small><b>{secondsLeft === null ? '∞' : `${bn(Math.floor(secondsLeft / 60)).padStart(2, '০')}:${bn(secondsLeft % 60).padStart(2, '০')}`}</b></div><span className="mcq-sr-only" aria-live="polite">{timerAnnouncement}</span></header>
      <div className="mcq-exam-progress"><span>{bn(answered)} / {bn(attempt.questionCount)} উত্তর দেওয়া</span><div role="progressbar" aria-label="উত্তর দেওয়া প্রশ্নের অগ্রগতি" aria-valuemin={0} aria-valuemax={attempt.questionCount} aria-valuenow={answered}><i style={{ width: `${answered / Math.max(1, attempt.questionCount) * 100}%` }} /></div><span className={`mcq-sync-status is-${saveState}`} aria-live="polite">{saveLabel}</span></div>
      {error && <div className="mcq-error" role="alert"><span>{error}</span>{secondsLeft === 0 && <button type="button" className="quiet-btn" disabled={busy} onClick={() => void submit()}>আবার ফলাফল আনুন</button>}</div>}
      {saveError && <div className="mcq-save-warning" role="status"><span>{saveError}</span><button type="button" className="quiet-btn" disabled={!navigator.onLine} onClick={() => void flushPendingSaves().catch(() => setSaveError('সংযোগ ফিরলে আবার চেষ্টা করুন।'))}>আবার পাঠান</button></div>}
      <div className="mcq-exam-layout"><article ref={questionCardRef} className="mcq-current-card">
        {question ? <><div className="mcq-question-number"><span>প্রশ্ন {bn(question.position)} / {bn(attempt.questionCount)}</span><button className={marked[question.position] ? 'is-bookmarked' : ''} type="button" onClick={() => toggleReview(question)}>{marked[question.position] ? '⚑ Review-তে আছে' : '⚑ পরে দেখব'}</button></div>
          {question.chapter && <p className="mcq-topic-label">{question.chapter}{question.topic ? ` · ${question.topic}` : ''}</p>}
          <h2 ref={questionHeadingRef} id="mcq-question-title" tabIndex={-1} lang="bn">{question.question}</h2>
          <QuestionMedia mediaIds={question.mediaIds} />
          <div className="mcq-choice-list" role="radiogroup" aria-label={`প্রশ্ন ${question.position} এর উত্তর`}>
            {question.options.map((option, index) => <label key={`${question.position}-${index}`} className={answers[question.position] === index ? 'is-selected' : ''}>
              <input type="radio" name={`question-${question.position}`} checked={answers[question.position] === index} disabled={busy} onChange={() => changeAnswer(question, index)} />
              <span className="mcq-choice-label">{option.label || choiceLabel(index)}</span><div className="mcq-choice-copy"><span lang="bn">{option.text}</span><QuestionMedia mediaIds={option.mediaIds || []} /></div>
            </label>)}
          </div>
          <div className="mcq-step-actions"><button type="button" className="quiet-btn" disabled={current === 0} onClick={() => navigateToQuestion(current - 1)}>← আগের প্রশ্ন</button><button type="button" className="button" disabled={current >= attempt.questionCount - 1} onClick={() => navigateToQuestion(current + 1)}>পরের প্রশ্ন →</button></div>
        </> : <Empty>পরীক্ষার প্রশ্ন পাওয়া যায়নি।</Empty>}
      </article>
      <aside className="mcq-navigator"><div><b>প্রশ্ন তালিকা</b><small>{bn(answered)}টির উত্তর · {bn(attempt.questionCount - answered)}টি বাকি</small></div><div className="mcq-number-grid">{attempt.questions.map((item, index) => <button key={item.position} type="button" onClick={() => navigateToQuestion(index)} className={`${current === index ? 'is-current ' : ''}${answers[item.position] !== undefined ? 'is-answered ' : ''}${marked[item.position] ? 'is-marked' : ''}`} aria-current={current === index ? 'step' : undefined} aria-label={`প্রশ্ন ${item.position}${answers[item.position] !== undefined ? ' উত্তর দেওয়া' : ' উত্তরহীন'}${marked[item.position] ? ', review' : ''}`}>{bn(item.position)}</button>)}</div><div className="mcq-legend" aria-label="প্রশ্নের অবস্থা"><span><i className="is-answered"/>উত্তর দেওয়া</span><span><i/>বাকি</span><span><i className="is-marked"/>Review</span></div><button className="button mcq-submit-wide" type="button" disabled={busy} onClick={() => setConfirmSubmit(true)}>পরীক্ষা জমা দিন</button></aside></div>
      {confirmSubmit && <div className="mcq-modal-backdrop"><section className="mcq-submit-dialog" role="dialog" aria-modal="true" aria-labelledby="mcq-submit-title" aria-describedby="mcq-submit-description" onKeyDown={event => { if (event.key === 'Escape') setConfirmSubmit(false); }}><span>✓</span><h2 id="mcq-submit-title">পরীক্ষা জমা দেবেন?</h2><p id="mcq-submit-description">{attempt.questionCount - answered ? `${bn(attempt.questionCount - answered)}টি প্রশ্নের উত্তর বাকি।` : 'সব প্রশ্নের উত্তর দেওয়া হয়েছে।'} জমা দিলে এই attempt আর বদলানো যাবে না।</p><div><button type="button" className="quiet-btn" autoFocus onClick={() => setConfirmSubmit(false)}>ফিরে যান</button><button type="button" className="button" disabled={busy} onClick={() => void submit()}>{busy ? 'জমা হচ্ছে…' : 'জমা নিশ্চিত করুন'}</button></div></section></div>}
    </section>;
  }

  const changeFilter = (key: 'classLevel' | 'groupName' | 'subject' | 'part', value: string) => setFilters(previous => ({ ...previous, [key]: value, ...(key === 'classLevel' ? { groupName: '', subject: '', part: '', chapters: [] } : {}), ...(key === 'groupName' ? { subject: '', part: '', chapters: [] } : {}), ...(key === 'subject' ? { part: '', chapters: [] } : {}), ...(key === 'part' ? { chapters: [] } : {}) }));
  const sortedClassOptions = [...classOptions].sort((a, b) => {
    const aNumber = Number(a.match(/\d+/u)?.[0] ?? Number.MAX_SAFE_INTEGER);
    const bNumber = Number(b.match(/\d+/u)?.[0] ?? Number.MAX_SAFE_INTEGER);
    return aNumber - bNumber || a.localeCompare(b, 'bn');
  });
  const dismissActive = async () => { if (!active) return; setBusy(true); try { await post(`/mcq/attempts/${active.id}/abandon`, {}); setActive(null); } catch (reason) { setError(reason instanceof Error ? reason.message : 'পরীক্ষাটি বাতিল করা যায়নি।'); } finally { setBusy(false); } };
  return <section className="page section mcq-page">
    <header className="mcq-hero"><div className="mcq-hero-copy"><span className="mcq-hero-kicker"><i/>নিজের মতো করে পরীক্ষা</span><p className="eyebrow">Private Tutor · MCQ পরীক্ষা</p><h1>প্রস্তুতি যাচাই করুন, আত্মবিশ্বাস বাড়ান</h1><p>আপনার শ্রেণি ও বিষয় বেছে অনুশীলন শুরু করুন। পরীক্ষা শেষে ফলাফল ও প্রতিটি উত্তরের ব্যাখ্যা দেখে পরের ধাপ ঠিক করুন।</p><div className="mcq-hero-tags"><span>✓ তাৎক্ষণিক ফল</span><span>◷ নিজের সময় বেছে নিন</span><span>✦ শেখার অগ্রগতি</span></div></div><div className="mcq-hero-art" aria-hidden="true"><b>MCQ</b><span>০১</span><i>✓</i><small>নিজের গতিতে এগিয়ে যান</small></div></header>
    {error && <p className="mcq-error" role="alert">{error}<button onClick={() => setError('')}>×</button></p>}
    {active && <section className="mcq-resume-card"><div className="mcq-resume-icon">↻</div><div><p className="eyebrow">অসমাপ্ত পরীক্ষা</p><h2>{active.classLevel} · {active.subject}</h2><p>{bn(active.questions.filter(question => question.selectedOption !== null).length)} / {bn(active.questionCount)}টি উত্তর সংরক্ষিত{active.expiresAt ? ` · বাকি ${formatDuration(Math.max(0, Math.floor((new Date(active.expiresAt).getTime() - now) / 1000)))}` : ''}</p></div><div><button className="button" disabled={busy} onClick={() => void resumeAttempt()}>পরীক্ষা চালিয়ে যান</button><button className="quiet-btn" disabled={busy} onClick={() => void dismissActive()}>নতুন পরীক্ষা নিন</button></div></section>}
    <div className="mcq-setup-grid"><section className="mcq-setup-card"><div className="mcq-section-heading"><span className="mcq-step">01</span><div><p className="eyebrow">পরীক্ষা সাজান</p><h2>কোন শ্রেণির MCQ দেবেন?</h2><p className="mcq-setup-intro">ধাপে ধাপে বেছে নিন—প্রথমে শ্রেণি, তারপর বিষয় ও প্রয়োজনীয় অধ্যায়।</p></div></div>
      <div className="mcq-filter-grid"><div className="mcq-class-picker" role="group" aria-labelledby="mcq-class-label" aria-describedby="mcq-class-help"><div className="mcq-class-picker-heading"><b id="mcq-class-label">১. আপনার শ্রেণি বেছে নিন</b>{filters.classLevel && <span>বেছে নিয়েছেন: <strong>{filters.classLevel}</strong></span>}</div><p id="mcq-class-help">শ্রেণি নির্বাচন করলে শুধু সেই শ্রেণির বিষয় ও MCQ দেখানো হবে।</p><div className="mcq-class-options">{sortedClassOptions.length ? sortedClassOptions.map(item => <button type="button" key={item} className={filters.classLevel === item ? 'is-selected' : ''} aria-pressed={filters.classLevel === item} onClick={() => changeFilter('classLevel', item)}>{item}<span aria-hidden="true">{filters.classLevel === item ? '✓' : '→'}</span></button>) : <p role="status">শ্রেণির তালিকা পাওয়া যাচ্ছে না। পৃষ্ঠা refresh করে আবার চেষ্টা করুন।</p>}</div></div>
        {filters.classLevel && catalog.groups.length > 0 && <label>Group <small>প্রযোজ্য হলে বেছে নিন</small><select value={filters.groupName} disabled={catalogRefreshing} onChange={event => changeFilter('groupName', event.target.value)}><option value="">সব Group</option>{catalog.groups.map(item => <option key={item}>{item}</option>)}</select></label>}
        <label className="mcq-subject-filter">২. বিষয়<select value={filters.subject} disabled={!filters.classLevel || catalogRefreshing} onChange={event => changeFilter('subject', event.target.value)}><option value="">{!filters.classLevel ? 'আগে শ্রেণি বেছে নিন' : catalogRefreshing ? 'বিষয় লোড হচ্ছে…' : 'বিষয় বেছে নিন'}</option>{catalog.subjects.map(item => <option key={item}>{item}</option>)}</select>{filters.classLevel && <small>{catalogRefreshing ? 'বিষয় লোড হচ্ছে…' : catalog.subjects.length ? `${bn(catalog.subjects.length)}টি বিষয় পাওয়া গেছে` : 'এই শ্রেণিতে বিষয় পাওয়া যায়নি।'}</small>}</label>
        {filters.classLevel && filters.subject && catalog.parts.length > 0 && <label>Part <small>ঐচ্ছিক</small><select value={filters.part} disabled={catalogRefreshing} onChange={event => changeFilter('part', event.target.value)}><option value="">সব Part</option>{catalog.parts.map(item => <option key={item}>{item}</option>)}</select></label>}
        {filters.classLevel && filters.subject && catalog.chapters.length > 0 && <div className="mcq-chapter-picker">
          <label htmlFor="mcq-chapter-search">Chapter <small>একটি বা একাধিক chapter বেছে নিন</small></label>
          <input id="mcq-chapter-search" type="search" value={chapterSearch} onChange={event => setChapterSearch(event.target.value)} placeholder="Chapter খুঁজুন…" autoComplete="off" />
          {filters.chapters.length > 0 && <div className="mcq-selected-chapters" aria-label="বেছে নেওয়া chapter">
            {filters.chapters.map(chapter => <button type="button" key={chapter} onClick={() => toggleChapter(chapter)} aria-label={`${chapter} বাদ দিন`}>{chapter}<span aria-hidden="true">×</span></button>)}
            <button type="button" className="mcq-clear-chapters" onClick={() => setFilters(previous => ({ ...previous, chapters: [] }))}>সব বাদ দিন</button>
          </div>}
          <div className="mcq-chapter-options" role="group" aria-label="Chapter বেছে নিন">
            {chapterMatches.length ? chapterMatches.map(chapter => <label key={chapter}>
              <input type="checkbox" checked={filters.chapters.includes(chapter)} onChange={() => toggleChapter(chapter)} />
              <span>{chapter}</span>
            </label>) : <p>এই নামে কোনো chapter পাওয়া যায়নি।</p>}
          </div>
          <small className="mcq-chapter-hint">{chapterSearch.trim() ? `${bn(Math.min(catalog.chapters.filter(chapter => chapter.toLocaleLowerCase().includes(chapterSearch.trim().toLocaleLowerCase())).length, 60))}টি মিল দেখানো হচ্ছে` : `${bn(catalog.chapters.length)}টি chapter · খুঁজে দ্রুত বেছে নিন`}</small>
        </div>}
      </div>
      <div className={`mcq-available${filters.classLevel && filters.subject ? '' : ' is-guidance'}`} aria-live="polite"><span><i/>{filters.classLevel && filters.subject ? catalogRefreshing ? 'প্রশ্নের সংখ্যা আপডেট হচ্ছে…' : mode === 'MISTAKES' ? 'এই বাছাইয়ে আগের ভুল প্রশ্ন' : mode === 'BOOKMARKED' ? 'এই বাছাইয়ে সংরক্ষিত প্রশ্ন' : 'আপনার বাছাইয়ে প্রশ্ন আছে' : filters.classLevel ? 'এখন বিষয় বেছে নিন—তারপর প্রশ্নের সংখ্যা দেখাবে' : 'শুরু করতে উপরের তালিকা থেকে একটি শ্রেণি বেছে নিন'}</span>{filters.classLevel && filters.subject && <b>{catalogRefreshing ? '…' : `${bn(catalog.availableCount)} `}<small>{catalogRefreshing ? '' : 'টি'}</small></b>}</div>
      {catalogError && <div className="mcq-error" role="alert"><span>{catalogError}</span><button type="button" className="quiet-btn" onClick={() => { setCatalogError(''); setCatalogRefreshing(true); void api<Catalog>(catalogUrl).then(setCatalog).catch(reason => setCatalogError(reason instanceof Error ? reason.message : 'প্রশ্ন খুঁজে পাওয়া যায়নি।')).finally(() => setCatalogRefreshing(false)); }}>আবার চেষ্টা করুন</button></div>}
      <div className="mcq-session-options"><label>পরীক্ষার ধরন<select value={mode} onChange={event => setMode(event.target.value)}><option value="STANDARD">সব প্রশ্ন থেকে নতুন পরীক্ষা</option><option value="MISTAKES">আগের ভুল প্রশ্ন অনুশীলন</option><option value="BOOKMARKED">সংরক্ষিত প্রশ্ন অনুশীলন</option></select></label>
        <div className="mcq-config-row"><label>কতটি প্রশ্ন?<div className="mcq-number-input"><button type="button" aria-label="প্রশ্ন কমান" disabled={questionCount <= 1 || catalogRefreshing} onClick={() => setQuestionCount(value => Math.max(1, value - 5))}>−</button><input type="number" min="1" max={maxQuestionCount} value={questionCount} aria-label="পরীক্ষার প্রশ্ন সংখ্যা" onChange={event => setQuestionCount(Math.max(1, Math.min(maxQuestionCount, Number(event.target.value) || 1)))}/><button type="button" aria-label="প্রশ্ন বাড়ান" disabled={questionCount >= maxQuestionCount || catalogRefreshing} onClick={() => setQuestionCount(value => Math.min(maxQuestionCount, value + 5))}>+</button></div></label>
          <label>সময়<select value={duration} onChange={event => setDuration(Number(event.target.value))}><option value={5}>৫ মিনিট</option><option value={10}>১০ মিনিট</option><option value={15}>১৫ মিনিট</option><option value={20}>২০ মিনিট</option><option value={30}>৩০ মিনিট</option><option value={45}>৪৫ মিনিট</option><option value={60}>৬০ মিনিট</option><option value={0}>সময় গণনা নয়</option></select></label></div>
      </div>
      <div className="mcq-exam-summary"><span><b>{bn(questionCount)}</b> প্রশ্ন</span><i>·</i><span><b>{duration ? bn(duration) : '∞'}</b> মিনিট</span><i>·</i><span><b>১</b> নম্বর / প্রশ্ন</span><strong>পূর্ণমান {bn(questionCount)}</strong></div>
      <button className="button mcq-start-button" disabled={busy || catalogRefreshing || Boolean(catalogError) || !filters.classLevel || !filters.subject || catalog.availableCount === 0 || questionCount > catalog.availableCount} onClick={() => void startAttempt({ ...filters, questionCount, durationMinutes: duration, mode })}>{busy ? 'প্রস্তুত হচ্ছে…' : catalogRefreshing ? 'প্রশ্ন খুঁজছি…' : 'পরীক্ষা শুরু করুন'} <span>→</span></button>
    </section><aside className="mcq-how-card"><p className="eyebrow">আপনার শেখার চক্র</p><h2>পরীক্ষা থেকে উন্নতি</h2><ol><li><i>1</i><div><b>বিষয় বেছে নিন</b><small>Class ও chapter ধরে প্রশ্ন ঠিক করুন</small></div></li><li><i>2</i><div><b>নিজের পরীক্ষা দিন</b><small>সময়, navigation ও উত্তর সংরক্ষণ</small></div></li><li><i>3</i><div><b>ভুল থেকে শিখুন</b><small>ব্যাখ্যা দেখুন, ভুল প্রশ্ন ফেরত দিন</small></div></li><li><i>4</i><div><b>অগ্রগতি ধরে রাখুন</b><small>XP, streak ও achievement সংগ্রহ করুন</small></div></li></ol><button className="quiet-btn" onClick={() => go('/dashboard')}>আমার অগ্রগতি দেখুন →</button></aside></div>
    <HistoryList />
  </section>;
}

function QuestionMedia({ mediaIds }: { mediaIds: string[] }) {
  if (!mediaIds?.length) return null;
  return <div className="mcq-question-media">{mediaIds.map(id => <img key={id} src={`/api/mcq/media/${encodeURIComponent(id)}`} alt="প্রশ্নের মূল diagram বা page image" loading="lazy" />)}</div>;
}

function ResultView({ result, onRetryMistakes, onNewExam }: { result: ExamResult; onRetryMistakes: () => void; onNewExam: () => void }) {
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const attempted = result.correctCount + result.wrongCount;
  return <section className="page section mcq-page mcq-result-page">
    <header className={`mcq-result-hero${result.percentage >= 80 ? ' is-strong' : ''}`}><span className="mcq-result-spark">✦</span><p className="eyebrow">পরীক্ষা সম্পন্ন</p><h1>{result.percentage >= 80 ? 'দারুণ করেছেন!' : result.percentage >= 50 ? 'ভালো অগ্রগতি—চালিয়ে যান' : 'এখান থেকেই উন্নতি শুরু'}</h1><p>{result.classLevel} · {result.subject}{result.part ? ` · ${result.part}` : ''}</p><div className="mcq-result-score"><b>{bn(result.score)}</b><span>/ {bn(result.totalScore)} নম্বর</span><strong>{bn(Math.round(result.percentage))}%</strong></div><div className="mcq-result-hero-meta"><span>◷ {formatDuration(result.timeTakenSeconds)}</span><span>✦ +{bn(result.xpEarned)} XP</span><span>{result.status === 'AUTO_SUBMITTED' ? 'সময় শেষে জমা হয়েছে' : 'নিজে জমা দিয়েছেন'}</span></div></header>
    <div className="mcq-result-stats"><article><small>সঠিক</small><b>{bn(result.correctCount)}</b><i className="mcq-stat-green">✓</i></article><article><small>ভুল</small><b>{bn(result.wrongCount)}</b><i className="mcq-stat-red">×</i></article><article><small>উত্তরহীন</small><b>{bn(result.unansweredCount)}</b><i>—</i></article><article><small>নির্ভুলতা</small><b>{bn(Math.round(result.accuracy))}%</b><i>◉</i></article></div>
    <section className="mcq-next-steps"><div><p className="eyebrow">পরের পদক্ষেপ</p><h2>আপনার শেখার পরামর্শ</h2></div><ul>{result.nextSteps.map((step, index) => <li key={step}><i>{index + 1}</i>{step}</li>)}</ul><div className="mcq-result-actions"><button className="button" onClick={onRetryMistakes}>ভুল প্রশ্ন আবার অনুশীলন করুন</button><button className="quiet-btn" onClick={onNewExam}>নতুন পরীক্ষা</button><button className="quiet-btn" onClick={() => go('/dashboard')}>অগ্রগতি দেখুন</button></div></section>
    <section className="mcq-review-list"><header><div><p className="eyebrow">প্রতিটি উত্তর থেকে শিখুন</p><h2>প্রশ্নভিত্তিক ফলাফল</h2></div><span>{bn(attempted)} / {bn(result.questionCount)} উত্তর দিয়েছেন</span></header>{result.review.map(item => <article className={`mcq-review-question${item.selectedIsCorrect ? ' is-correct' : item.selectedOption === null ? ' is-unanswered' : ' is-wrong'}`} key={item.position}><div className="mcq-review-question-head"><b>প্রশ্ন {bn(item.position)}</b><span>{item.selectedIsCorrect ? '✓ সঠিক' : item.selectedOption === null ? 'উত্তরহীন' : '✕ ভুল'}</span><button type="button" aria-label="প্রশ্ন সংরক্ষণ করুন" className={saved[item.questionId || ''] ? 'is-bookmarked' : ''} disabled={!item.questionId} onClick={() => { const id = item.questionId!; void post<{ saved: boolean }>(`/mcq/bookmarks/${id}`, {}).then(answer => setSaved(current => ({ ...current, [id]: answer.saved }))); }}>{saved[item.questionId || ''] ? '♥ সংরক্ষিত' : '♡ সংরক্ষণ'}</button></div><h3 lang="bn">{item.question}</h3><QuestionMedia mediaIds={item.mediaIds} /><div className="mcq-review-options">{item.options.map((option, index) => <div className={`${index === item.correctOption ? 'is-answer ' : ''}${index === item.selectedOption ? 'is-selected' : ''}`} key={index}><span>{option.label || choiceLabel(index)}</span><div className="mcq-review-option-copy"><p>{option.text}</p><QuestionMedia mediaIds={option.mediaIds || []} /></div>{index === item.correctOption && <b>সঠিক উত্তর</b>}{index === item.selectedOption && <small>আপনার উত্তর</small>}</div>)}</div>{item.explanation && <p className="mcq-explanation"><b>ব্যাখ্যা</b>{item.explanation}</p>}</article>)}</section>
  </section>;
}

function HistoryList() {
  const [history, setHistory] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { void api<any[]>('/mcq/history?limit=8').then(setHistory).catch(reason => setError(reason instanceof Error ? reason.message : 'ইতিহাস আনা যায়নি।')); }, []);
  return <section className="mcq-history"><header><div><p className="eyebrow">ফিরে দেখুন</p><h2>সাম্প্রতিক পরীক্ষা</h2></div><button className="quiet-btn" onClick={() => go('/dashboard')}>সম্পূর্ণ অগ্রগতি →</button></header>{error ? <p className="mcq-muted">প্রশ্ন ব্যাংক চালু হলে আপনার exam history এখানে দেখা যাবে।</p> : !history ? <Loading /> : history.length ? <div className="mcq-history-list">{history.map(item => <article key={item.id}><div className="mcq-history-icon">✓</div><div><b>{item.subject}</b><small>{item.classLevel}{item.part ? ` · ${item.part}` : ''} · {shortDate(item.submittedAt)}</small></div><div className="mcq-history-score"><b>{bn(Math.round(item.percentage))}%</b><small>{bn(item.correctCount)} / {bn(item.questionCount)} সঠিক</small></div></article>)}</div> : <div className="mcq-history-empty"><span>✦</span><b>আপনার প্রথম পরীক্ষা এখানেই শুরু হতে পারে</b><small>প্রতিটি ফলাফল আপনার শেখার যাত্রায় যোগ হবে।</small></div>}</section>;
}

export function McqProgressCard() {
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { void api<ProfileStats>('/mcq/profile').then(setStats).catch(reason => setError(reason instanceof Error ? reason.message : 'MCQ অগ্রগতি লোড হয়নি।')); }, []);
  const nextLevelXp = stats ? stats.level * stats.level * 100 : 100;
  const previousLevelXp = stats ? (stats.level - 1) * (stats.level - 1) * 100 : 0;
  const levelProgress = stats ? Math.min(100, (stats.xp - previousLevelXp) / Math.max(1, nextLevelXp - previousLevelXp) * 100) : 0;
  return <section className="mcq-progress-card"><header><div><p className="eyebrow">আপনার MCQ যাত্রা</p><h2>অনুশীলনে এগিয়ে যান</h2></div><button className="button" onClick={() => go('/mcq-exam')}>পরীক্ষা →</button></header>{error ? <div className="mcq-progress-empty"><span>✦</span><b>নিজের প্রথম topic বেছে নিন</b><p>MCQ পরীক্ষায় progress, streak ও achievement তৈরি হবে।</p><button className="quiet-btn" onClick={() => go('/mcq-exam')}>প্রশ্ন খুঁজুন</button></div> : !stats ? <Loading /> : <><div className="mcq-level-row"><Avatar name={String(stats.level)} size="lg"/><div><small>LEARNING LEVEL {bn(stats.level)}</small><b>{stats.totalExams ? 'MCQ Explorer' : 'নতুন শিক্ষার্থী'}</b><div className="mcq-level-track"><i style={{ width: `${levelProgress}%` }} /></div><span>{bn(stats.xp)} XP · পরের level-এ {bn(Math.max(0, nextLevelXp - stats.xp))} XP</span></div><div className="mcq-streak"><b>🔥 {bn(stats.currentStreak)}</b><small>দিনের streak</small></div></div><div className="mcq-progress-stats"><article><small>পরীক্ষা</small><b>{bn(stats.totalExams)}</b></article><article><small>উত্তর দিয়েছেন</small><b>{bn(stats.totalAttempted)}</b></article><article><small>সঠিকের হার</small><b>{bn(Math.round(stats.accuracy))}%</b></article><article><small>সেরা score</small><b>{bn(Math.round(stats.bestScore))}%</b></article><article><small>গড় score</small><b>{bn(Math.round(stats.averageScore))}%</b></article><article><small>সর্বোচ্চ streak</small><b>{bn(stats.longestStreak)} দিন</b></article></div><div className="mcq-badges">{stats.badges.length ? stats.badges.map(badge => <span key={badge}>✦ {badge}</span>) : <small>প্রথম পরীক্ষা শেষ হলে আপনার badge এখানে আসবে।</small>}</div>{stats.recentAttempts.length > 0 && <div className="mcq-profile-recent"><b>সাম্প্রতিক অগ্রগতি</b>{stats.recentAttempts.slice(0, 3).map(item => <span key={item.id}>{item.subject} <i>{bn(Math.round(item.percentage))}%</i></span>)}</div>}</>}</section>;
}

export function AdminMcqBankPage() {
  const [tab, setTab] = useState<'overview' | 'review' | 'questions'>('overview');
  const [summary, setSummary] = useState<any>(null);
  const [sources, setSources] = useState<SourcePage | null>(null);
  const [issues, setIssues] = useState<IssuePage | null>(null);
  const [questions, setQuestions] = useState<any[] | null>(null);
  const [query, setQuery] = useState('');
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [draftQuestion, setDraftQuestion] = useState('');
  const [draftOptions, setDraftOptions] = useState('');
  const [draftAnswer, setDraftAnswer] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const loadOverview = useCallback(async () => {
    try { const [nextSummary, nextSources] = await Promise.all([api('/admin/mcq/summary'), api<SourcePage>('/admin/mcq/sources?take=30')]); setSummary(nextSummary); setSources(nextSources); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Question bank আনা যায়নি।'); }
  }, []);
  const loadIssues = useCallback(async () => { try { setIssues(await api<IssuePage>('/admin/mcq/issues?take=30')); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Review queue আনা যায়নি।'); } }, []);
  const loadQuestions = useCallback(async (search = '') => { try { const page = await api<{ items: any[] }>('/admin/mcq/questions?take=50&q=' + encodeURIComponent(search)); setQuestions(page.items); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Question bank আনা যায়নি।'); } }, []);
  useEffect(() => { void loadOverview(); void loadIssues(); void loadQuestions(); }, [loadOverview, loadIssues, loadQuestions]);
  const reconciliation = (item: any) => Number(item.totalDetectedMcqs) === Number(item.totalImportedMcqs) + Number(item.totalDuplicates) + Number(item.totalRejected) + Number(item.totalAmbiguous);
  const reviewIssue = (issue: any) => {
    const interpretation = issue.parserInterpretation || {};
    const options = Array.isArray(interpretation.options) ? interpretation.options : [];
    const answerLabel = String(interpretation.answer_label || '');
    const answerIndex = options.findIndex((option: any) => option.label === answerLabel);
    setSelectedIssue(issue); setDraftQuestion(String(interpretation.question || ''));
    setDraftOptions(options.map((option: any) => option.text).join('\n'));
    setDraftAnswer(Math.max(0, answerIndex));
  };
  const resolveIssue = async (action: 'PUBLISH' | 'REJECT') => {
    if (!selectedIssue) return;
    setBusy(true); setError('');
    try {
      const options = draftOptions.split('\n').map(text => text.trim()).filter(Boolean).map((text, index) => ({ label: choiceLabel(index), text }));
        await post(`/admin/mcq/issues/${selectedIssue.id}/resolve`, action === 'PUBLISH' ? { action, question: { question: draftQuestion, options, correctOption: draftAnswer } } : { action });
      setSelectedIssue(null); await Promise.all([loadOverview(), loadIssues(), loadQuestions(query)]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Review item আপডেট হয়নি।'); }
    finally { setBusy(false); }
  };
  const searchQuestions = (event: React.FormEvent) => { event.preventDefault(); void loadQuestions(query); };
  return <section className="page section mcq-admin-page"><header className="mcq-admin-heading"><div><p className="eyebrow">Private Tutor · পরিচালনা</p><h1>MCQ প্রশ্ন ব্যাংক</h1><p>Source file, import audit, review queue ও প্রকাশিত প্রশ্ন একই জায়গা থেকে পরিচালনা করুন।</p></div><span className="mcq-admin-mark">▤</span></header>
    {error && <p className="mcq-error" role="alert">{error}<button onClick={() => setError('')}>×</button></p>}
    <div className="mcq-admin-tabs" role="tablist"><button className={tab === 'overview' ? 'is-active' : ''} onClick={() => setTab('overview')}>Import audit</button><button className={tab === 'review' ? 'is-active' : ''} onClick={() => setTab('review')}>Review queue {summary?.openIssues ? <b>{bn(summary.openIssues)}</b> : null}</button><button className={tab === 'questions' ? 'is-active' : ''} onClick={() => setTab('questions')}>Question bank</button></div>
    {tab === 'overview' && <><div className="mcq-admin-stats">{[["Files discovered", summary?.filesDiscovered], ["MCQ detected", summary?.detected], ["Imported", summary?.imported], ["Duplicates", summary?.duplicates], ["Needs review", summary?.needsReview], ["Failed files", summary?.filesFailed]].map(([label, count]) => <article key={String(label)}><small>{label}</small><b>{count === undefined ? '—' : bn(Number(count))}</b></article>)}</div><section className="mcq-import-guide"><span>↥</span><div><p className="eyebrow">Local folder import</p><h2>৫,১০১টি source file audit করে import করুন</h2><p>Importer প্রশ্ন নিজে থেকে rewrite করে না। DOC/DOCX/PDF file আলাদা করে পড়বে, readable text হলে parse করবে, scanned PDF-এ Bengali OCR চেষ্টা করবে এবং প্রতিটি unresolved file/প্রশ্ন report করবে।</p><code>python tools/mcq_importer.py "C:\Users\user\Downloads\Exam" --api-url https://shikhok.onrender.com</code><small>Import account-এর secure admin email/password environment variable-এ দিন। `audit.csv`, `summary.json` ও per-file JSON report local output folder-এ থাকবে।</small></div></section><section className="mcq-admin-table"><header><div><p className="eyebrow">Traceable source</p><h2>Source file audit</h2></div><button className="quiet-btn" onClick={() => void loadOverview()}>↻ Refresh</button></header><div className="mcq-table-scroll"><table><thead><tr><th>File</th><th>Class / Subject</th><th>Detected</th><th>Imported</th><th>Duplicate</th><th>Review</th><th>Rejected</th><th>Status</th></tr></thead><tbody>{sources?.items.map(item => <tr key={item.id}><td><b>{item.sourceFilename}</b><small>{item.sourcePath}</small></td><td>{item.classLevel || '—'}<small>{item.subject || '—'}{item.part ? ` · ${item.part}` : ''}</small></td><td>{bn(item.totalDetectedMcqs)}</td><td>{bn(item.totalImportedMcqs)}</td><td>{bn(item.totalDuplicates)}</td><td>{bn(item.totalAmbiguous)}</td><td>{bn(item.totalRejected)}</td><td><span className={`mcq-source-status ${item.processingStatus.toLowerCase()}`}>{item.processingStatus}</span><small>{reconciliation(item) ? 'Reconciled' : 'Count mismatch'}</small></td></tr>)}</tbody></table></div>{!sources?.items.length && <Empty>Import শুরু হলে source file status এখানে দেখা যাবে।</Empty>}</section></>}
    {tab === 'review' && <section className="mcq-admin-review"><header><div><p className="eyebrow">প্রতিটি অনিশ্চিত প্রশ্ন আলাদা করে দেখুন</p><h2>Review queue</h2></div><button className="quiet-btn" onClick={() => void loadIssues()}>↻ Refresh</button></header>{issues?.items.length ? issues.items.map(issue => <article className="mcq-issue-card" key={issue.id}><div className="mcq-issue-meta"><span>{issue.sourceFile.sourceFilename}</span><span>{issue.sourceFile.classLevel} · {issue.sourceFile.subject}</span><span>{issue.page ? `পৃষ্ঠা ${bn(issue.page)}` : issue.candidateIndex ? `Candidate ${bn(issue.candidateIndex)}` : 'Source issue'}</span></div><h3>{issue.problem}</h3><pre>{issue.rawExtractedText || 'পড়ার মতো text পাওয়া যায়নি।'}</pre><QuestionMedia mediaIds={issue.mediaIds || []} /><details><summary>Parser interpretation</summary><pre>{JSON.stringify(issue.parserInterpretation, null, 2)}</pre></details>{issue.candidateIndex ? <button className="button" onClick={() => reviewIssue(issue)}>Review / correct</button> : <p className="mcq-muted">এটি নির্দিষ্ট MCQ নয়, source/page issue। মূল page ঠিক করে আবার import করুন।</p>}</article>) : <Empty>এখন খোলা কোনো import issue নেই।</Empty>}</section>}
    {tab === 'questions' && <section className="mcq-admin-questions"><form onSubmit={searchQuestions}><label>প্রশ্ন খুঁজুন<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Bangla বা English text" /></label><button className="button">Search</button></form>{questions?.length ? questions.map(question => <article key={question.id}><header><span>{question.classLevel} · {question.subject}{question.chapter ? ` · ${question.chapter}` : ''}</span><small>{question.status}</small></header><h3>{question.questionText}</h3><QuestionMedia mediaIds={question.mediaIds || []} /><div>{(question.options as Choice[]).map((option, index) => <span className={index === question.correctOption ? 'is-correct' : ''} key={index}>{option.label || choiceLabel(index)}. {option.text}<QuestionMedia mediaIds={option.mediaIds || []} /></span>)}</div><footer>Source: {question.sourceFile.sourceFilename} · {question.sourceLocation || 'page not identified'}</footer></article>) : <Empty>প্রকাশিত question bank-এ কোনো প্রশ্ন মেলেনি।</Empty>}</section>}
    {selectedIssue && <div className="mcq-modal-backdrop"><section className="mcq-admin-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="mcq-review-title"><button className="mcq-close" aria-label="বন্ধ করুন" onClick={() => setSelectedIssue(null)}>×</button><p className="eyebrow">Source: {selectedIssue.sourceFile.sourceFilename}</p><h2 id="mcq-review-title">Question ঠিক করে publish করুন</h2><label>Question<textarea rows={4} value={draftQuestion} onChange={event => setDraftQuestion(event.target.value)} /></label><label>প্রতি লাইনে একটি option<textarea rows={5} value={draftOptions} onChange={event => setDraftOptions(event.target.value)} /></label><label>সঠিক option<select value={draftAnswer} onChange={event => setDraftAnswer(Number(event.target.value))}>{draftOptions.split('\n').filter(line => line.trim()).map((_, index) => <option value={index} key={index}>{choiceLabel(index)}</option>)}</select></label><p className="mcq-admin-source-text"><b>Original extracted text</b>{selectedIssue.rawExtractedText}</p><QuestionMedia mediaIds={selectedIssue.mediaIds || []} /><div><button className="quiet-btn" disabled={busy} onClick={() => setSelectedIssue(null)}>বাতিল</button><button className="danger-btn" disabled={busy} onClick={() => void resolveIssue('REJECT')}>কারণসহ reject</button><button className="button" disabled={busy || !draftQuestion.trim() || draftOptions.split('\n').filter(line => line.trim()).length < 2} onClick={() => void resolveIssue('PUBLISH')}>{busy ? 'সংরক্ষণ হচ্ছে…' : 'সংশোধন publish করুন'}</button></div></section></div>}
  </section>;
}

