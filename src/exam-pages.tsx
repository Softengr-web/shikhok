import { useEffect, useRef, useState } from 'react';
import { api, post } from './api';
import { Avatar, Empty, Loading, bn, go } from './components';
import { ExamAnswerReview } from './exam-review';
import type { Exam, ExamAttemptResult } from './models';
import './exam-pages.css';

type DraftQuestion = { id: string; text: string; options: string[]; answer: number; marks: number };
const newQuestion = (): DraftQuestion => ({ id: `new-${Date.now()}-${Math.random()}`, text: '', options: ['', '', '', ''], answer: 0, marks: 1 });
const statusLabel = (status?: Exam['status']) => ({ DRAFT: 'খসড়া', PUBLISHED: 'প্রকাশিত', CLOSED: 'বন্ধ' }[status || 'PUBLISHED'] || 'প্রকাশিত');

export function TeacherExamDashboard() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selected, setSelected] = useState<Exam | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => { setLoading(true); try { setExams(await api<Exam[]>('/teacher/exams')); } catch (e) { setError(e instanceof Error ? e.message : 'পরীক্ষা লোড করা যায়নি।'); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const openResults = async (exam: Exam) => { setSelected(exam); setResults(await api<any[]>(`/teacher/exams/${exam.id}/results`)); };
  const status = async (exam: Exam, next: 'PUBLISHED' | 'CLOSED') => { await post(`/teacher/exams/${exam.id}/status`, { status: next }); await load(); };
  const duplicate = async (exam: Exam) => { await post(`/teacher/exams/${exam.id}/duplicate`); await load(); };
  const copy = async (exam: Exam) => { if (!exam.sharePath) return; await navigator.clipboard?.writeText(`${location.origin}${location.pathname}#${exam.sharePath}`); setError('পরীক্ষার লিংক কপি হয়েছে।'); };
  if (loading) return <Loading />;
  return <section className="page section"><div className="section-head learning-art-header"><div><p className="eyebrow">শিক্ষক পরীক্ষা ব্যবস্থাপনা</p><h1>আমার পরীক্ষা</h1></div><button className="button" onClick={() => go('/teacher/exams/new')}>নতুন পরীক্ষা তৈরি করুন</button></div>{error && <p className="success">{error}</p>}{exams.length ? <div className="exam-admin-list">{exams.map(exam => <article className="exam-admin-card" key={exam.id}><div><span className={`status ${exam.status}`}>{statusLabel(exam.status)}</span><h2>{exam.title}</h2><p>{exam.subject} · {bn(exam.questions as number || exam.questionIds?.length || 0)}টি প্রশ্ন · {bn(exam.duration)} মিনিট · {bn(exam.totalMarks || 0)} নম্বর</p><small>অংশগ্রহণকারী: {bn(exam.participants || 0)} · গড়: {bn(Math.round(exam.averageScore || 0))}% · সর্বোচ্চ: {bn(Math.round(exam.highestScore || 0))}%</small></div><div className="card-actions"><button className="quiet-btn" onClick={() => void openResults(exam)}>ফলাফল দেখুন</button>{exam.status === 'PUBLISHED' ? <button className="quiet-btn" onClick={() => void status(exam, 'CLOSED')}>বন্ধ করুন</button> : <button className="quiet-btn" onClick={() => void status(exam, 'PUBLISHED')}>প্রকাশ করুন</button>}<button className="quiet-btn" onClick={() => void duplicate(exam)}>ডুপ্লিকেট</button>{exam.sharePath && <button className="button small" onClick={() => void copy(exam)}>লিংক কপি</button>}</div></article>)}</div> : <Empty>এখনও কোনো পরীক্ষা তৈরি হয়নি।</Empty>}{selected && <div className="modal-back"><section className="modal results-modal"><button className="close" onClick={() => setSelected(null)}>×</button><p className="eyebrow">শিক্ষার্থী ফলাফল</p><h2>{selected.title}</h2>{results.length ? <div className="result-table"><div className="result-row result-head"><b>শিক্ষার্থী</b><b>স্কোর</b><b>শতাংশ</b><b>অবস্থা</b></div>{results.map(result => <div className="result-row" key={result.id}><span><Avatar name={result.student.name} size="sm" />{result.student.name}</span><span>{bn(result.score)}/{bn(result.total)}</span><span>{bn(result.percentage || 0)}%</span><strong className={result.passed ? 'green' : 'red'}>{result.passed ? 'উত্তীর্ণ' : 'অনুত্তীর্ণ'}</strong></div>)}</div> : <Empty>এখনও কোনো শিক্ষার্থী পরীক্ষা জমা দেয়নি।</Empty>}</section></div>}</section>;
}

export function TeacherExamEditor() {
  const [exam, setExam] = useState({ title: '', description: '', instructions: '', subject: 'গণিত', topic: '', duration: '30', passMark: '40', showAnswers: true });
  const [questions, setQuestions] = useState<DraftQuestion[]>([newQuestion()]);
  const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const updateQuestion = (index: number, patch: Partial<DraftQuestion>) => setQuestions(current => current.map((question, i) => i === index ? { ...question, ...patch } : question));
  const updateOption = (questionIndex: number, optionIndex: number, value: string) => setQuestions(current => current.map((question, i) => i === questionIndex ? { ...question, options: question.options.map((option, j) => j === optionIndex ? value : option) } : question));
  const move = (index: number, direction: -1 | 1) => { const next = index + direction; if (next < 0 || next >= questions.length) return; const copy = [...questions]; [copy[index], copy[next]] = [copy[next], copy[index]]; setQuestions(copy); };
  const save = async (publish: boolean) => { setBusy(true); setError(''); try { const result = await post<{ sharePath?: string }>('/teacher/exams', { ...exam, duration: Number(exam.duration), passMark: Number(exam.passMark), questions, publish }); setMessage(publish ? `পরীক্ষা প্রকাশিত হয়েছে। ${result.sharePath || ''}` : 'পরীক্ষাটি খসড়া হিসেবে সংরক্ষিত হয়েছে।'); } catch (e) { setError(e instanceof Error ? e.message : 'পরীক্ষা সংরক্ষণ করা যায়নি।'); } finally { setBusy(false); } };
  return <section className="page section exam-editor"><p className="eyebrow">শিক্ষক পরীক্ষা নির্মাতা</p><h1>নতুন MCQ পরীক্ষা</h1><div className="exam-form-grid"><div><label>পরীক্ষার শিরোনাম<input value={exam.title} onChange={e => setExam({ ...exam, title: e.target.value })} required /></label><label>বর্ণনা<textarea value={exam.description} onChange={e => setExam({ ...exam, description: e.target.value })} /></label><label>নির্দেশনা<textarea value={exam.instructions} onChange={e => setExam({ ...exam, instructions: e.target.value })} /></label><div className="two"><label>বিষয়<input value={exam.subject} onChange={e => setExam({ ...exam, subject: e.target.value })} required /></label><label>টপিক<input value={exam.topic} onChange={e => setExam({ ...exam, topic: e.target.value })} /></label></div><div className="two"><label>সময় (মিনিট)<input type="number" min="1" value={exam.duration} onChange={e => setExam({ ...exam, duration: e.target.value })} /></label><label>পাস নম্বর (%)<input type="number" min="0" max="100" value={exam.passMark} onChange={e => setExam({ ...exam, passMark: e.target.value })} /></label></div><label className="check"><input type="checkbox" checked={exam.showAnswers} onChange={e => setExam({ ...exam, showAnswers: e.target.checked })} /> জমা দেওয়ার পর বিস্তারিত ফলাফল দেখান</label></div><aside className="aside-card"><h3>প্রিভিউ ও প্রকাশ</h3><p>{exam.title || 'পরীক্ষার নাম'} · {bn(questions.length)}টি প্রশ্ন</p><p>মোট নম্বর: {bn(questions.reduce((sum, question) => sum + Number(question.marks || 0), 0))}</p><p>সময়: {bn(Number(exam.duration) || 0)} মিনিট</p>{message && <p className="success">{message}</p>}{error && <p className="form-error">{error}</p>}<button className="quiet-btn wide" disabled={busy} onClick={() => void save(false)}>খসড়া সংরক্ষণ</button><button className="button wide" disabled={busy} onClick={() => void save(true)}>প্রকাশ করুন</button></aside></div><div className="exam-question-list"><div className="section-head"><h2>প্রশ্নসমূহ</h2><button className="quiet-btn" onClick={() => setQuestions([...questions, newQuestion()])}>+ প্রশ্ন যোগ করুন</button></div>{questions.map((question, index) => <article className="question-editor" key={question.id}><div className="question-editor-head"><b>প্রশ্ন {bn(index + 1)}</b><div><button className="quiet-btn" type="button" onClick={() => move(index, -1)}>উপরে</button><button className="quiet-btn" type="button" onClick={() => move(index, 1)}>নিচে</button><button className="danger-btn" type="button" onClick={() => setQuestions(questions.filter((_, i) => i !== index))}>মুছুন</button></div></div><textarea placeholder="প্রশ্ন লিখুন" value={question.text} onChange={e => updateQuestion(index, { text: e.target.value })} required />{question.options.map((option, optionIndex) => <label key={optionIndex}>বিকল্প {bn(optionIndex + 1)}<input value={option} onChange={e => updateOption(index, optionIndex, e.target.value)} required /></label>)}<div className="two"><label>সঠিক উত্তর<select value={question.answer} onChange={e => updateQuestion(index, { answer: Number(e.target.value) })}>{question.options.map((_, optionIndex) => <option value={optionIndex} key={optionIndex}>বিকল্প {bn(optionIndex + 1)}</option>)}</select></label><label>নম্বর<input type="number" min="1" value={question.marks} onChange={e => updateQuestion(index, { marks: Number(e.target.value) })} /></label></div></article>)}</div></section>;
}

export function StudentExamPage() {
  const token = location.hash.split('/')[2]?.split('?')[0] || '';
  const [exam, setExam] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<ExamAttemptResult | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  useEffect(() => { void api<Exam>(`/exams/share/${token}`).then(data => { setExam(data); setSeconds(data.duration * 60); }).catch(cause => setError(cause instanceof Error ? cause.message : 'পরীক্ষা লোড করা যায়নি।')); }, [token]);
  const submit = async () => {
    if (!exam || submitting || result) return;
    setSubmitting(true);
    setError('');
    try { setResult(await post<ExamAttemptResult>(`/exams/${exam.id}/submit`, { answers: answersRef.current })); setConfirmSubmit(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'পরীক্ষা জমা দেওয়া যায়নি।'); }
    finally { setSubmitting(false); }
  };
  useEffect(() => {
    if (!exam || result || seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds(value => {
      if (value <= 1) { window.clearInterval(timer); void submit(); return 0; }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [exam, result]);

  if (error && !exam) return <section className="page section exam-error-state"><span>!</span><h1>পরীক্ষাটি খোলা যায়নি</h1><p>{error}</p><button className="quiet-btn" type="button" onClick={() => go('/exams')}>পরীক্ষার তালিকায় ফিরুন</button></section>;
  if (!exam) return <Loading />;
  const questions = Array.isArray(exam.questions) ? exam.questions : [];
  const answered = questions.filter(question => answers[question.id] !== undefined).length;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  return <section className="page section exam-session">
    <header className="exam-session-heading learning-art-header">
      <button className="exam-back-link" type="button" onClick={() => go('/exams')}>← <span>সব পরীক্ষা</span></button>
      <div className="exam-session-title"><p className="eyebrow">{exam.subject} · {statusLabel(exam.status)}</p><h1>{exam.title}</h1><p>{exam.instructions || exam.description || 'প্রতিটি প্রশ্নে একটি সঠিক উত্তর বেছে নিন।'}</p></div>
      <div className={`exam-timer${seconds < 60 ? ' is-urgent' : ''}`}><span aria-hidden="true">◷</span><b>{String(minutes).padStart(2, '0')}:{String(remaining).padStart(2, '0')}</b><small>{bn(answered)}/{bn(questions.length)} উত্তর</small></div>
    </header>
    {!result && <div className="exam-progress-card"><div><span>উত্তর দেওয়া হয়েছে</span><b>{bn(answered)} <small>/ {bn(questions.length)}</small></b></div><div className="exam-progress-track"><i style={{ width: `${questions.length ? answered / questions.length * 100 : 0}%` }} /></div><div className="exam-question-jump">{questions.map((question, index) => <button className={answers[question.id] === undefined ? '' : 'is-answered'} type="button" key={question.id} aria-label={`প্রশ্ন ${bn(index + 1)}`} onClick={() => document.getElementById(`exam-q-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>{bn(index + 1)}</button>)}</div></div>}
    {error && <p className="exam-feedback" role="alert">{error}</p>}
    {result ? <div className="exam-result-wrap"><section className={`exam-result-card${result.passed ? ' is-passed' : ' is-failed'}`}><span className="exam-result-icon" aria-hidden="true">{result.passed ? '✓' : '↗'}</span><p className="eyebrow">পরীক্ষা সম্পন্ন</p><h2>{result.passed ? 'চমৎকার কাজ!' : 'আরও একটু অনুশীলন করুন'}</h2><strong className="exam-result-score">{bn(result.score)} <small>/ {bn(result.total)}</small></strong><div className="exam-result-percent">{bn(result.percentage || 0)}%</div><div className="exam-result-stats"><span><b>{bn(result.correctCount)}</b>সঠিক</span><span><b>{bn(result.incorrectCount)}</b>ভুল</span><span><b>{bn(result.unansweredCount)}</b>উত্তরহীন</span></div><p className={`exam-pass-state${result.passed ? ' is-passed' : ' is-failed'}`}>{result.passed ? 'পাস নম্বর অর্জিত হয়েছে' : `পাস করতে প্রয়োজন ${bn(exam.passMark)}%`}</p><button className="button" type="button" onClick={() => go('/exams')}>অন্য পরীক্ষা বেছে নিন</button></section>{result.showAnswers ? <ExamAnswerReview review={result.review || []} /> : <p className="exam-review-hidden">এই পরীক্ষার উত্তরমালা শিক্ষক প্রকাশ করেননি।</p>}</div> : <>
      <div className="exam-instruction-note"><span aria-hidden="true">✦</span><p>উত্তর বেছে নিন। জমা দেওয়ার পর স্কোর, সঠিক উত্তর ও ব্যাখ্যা দেখতে পারবেন।</p></div>
      <div className="exam-session-questions">{questions.map((question, index) => <fieldset className="exam-session-question" id={`exam-q-${index}`} key={question.id}><legend><span>প্রশ্ন {bn(index + 1)}</span><small>{bn(question.marks)} নম্বর</small></legend><h2>{question.text}</h2><div className="exam-session-options">{question.options.map((option, optionIndex) => <label className={answers[question.id] === optionIndex ? 'is-selected' : ''} key={`${question.id}-${optionIndex}`}><input type="radio" name={question.id} checked={answers[question.id] === optionIndex} onChange={() => setAnswers(current => ({ ...current, [question.id]: optionIndex }))} /><span className="exam-option-letter">{String.fromCharCode(65 + optionIndex)}</span><span>{option}</span><i aria-hidden="true">✓</i></label>)}</div></fieldset>)}</div>
      <footer className="exam-submit-bar"><span><b>{bn(answered)}/{bn(questions.length)}</b>টি প্রশ্নের উত্তর দেওয়া হয়েছে</span><button className="button" type="button" disabled={submitting} onClick={() => setConfirmSubmit(true)}>{submitting ? 'জমা হচ্ছে…' : 'পরীক্ষা জমা দিন'} <span aria-hidden="true">→</span></button></footer>
    </>}
    {confirmSubmit && !result && <div className="exam-confirm-backdrop"><section className="exam-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="exam-confirm-title"><span aria-hidden="true">✓</span><h2 id="exam-confirm-title">উত্তর জমা দেবেন?</h2><p>{answered === questions.length ? 'সব প্রশ্নের উত্তর দেওয়া হয়েছে।' : `${bn(questions.length - answered)}টি প্রশ্নের উত্তর দেওয়া হয়নি। জমা দিলে আর পরিবর্তন করা যাবে না।`}</p><div><button className="quiet-btn" type="button" onClick={() => setConfirmSubmit(false)}>আরও দেখুন</button><button className="button" type="button" disabled={submitting} onClick={() => void submit()}>{submitting ? 'জমা হচ্ছে…' : 'জমা নিশ্চিত করুন'}</button></div></section></div>}
  </section>;
}

