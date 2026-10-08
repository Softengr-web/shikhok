import { useEffect, useRef, useState } from 'react';
import { api, post, put } from './api';
import { Avatar, BookingModal, Empty, Loading, TeacherCard, bn, go, money, photoFromUser, shortDate } from './components';
import { StudentProfileEditor } from './profile-editors';
import type { Booking, Exam, ExamAttemptResult, Gig, Notification, ProblemPost, Subject, Teacher, User } from './models';
import { ExamAnswerReview } from './exam-review';
import { ClassroomRoom } from './classroom-room';
import { McqProgressCard } from './mcq-exam';
export const Classroom = ClassroomRoom;

export function Home({ user }: { user: User | null }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [q, setQ] = useState('');
  const [compare, setCompare] = useState<Teacher[]>([]);

  useEffect(() => {
    void Promise.all([
      api<Subject[]>('/subjects'),
      api<{ items: Teacher[] }>('/teachers?perPage=4')
    ]).then(([subjectItems, teacherItems]) => {
      setSubjects(subjectItems);
      setTeachers(teacherItems.items);
    });
  }, []);

  const toggle = (teacher: Teacher) => setCompare(current =>
    current.some(item => item.id === teacher.id)
      ? current.filter(item => item.id !== teacher.id)
      : current.length < 3 ? [...current, teacher] : current
  );

  return <>
    <section className="hero learning-art-header">
      <div className="hero-copy">
        <p className="hero-brand" aria-label="Private Tutor">Private <span>Tutor</span><i aria-hidden="true"></i></p>
        <p className="eyebrow">বাংলাদেশের শিক্ষক মার্কেটপ্লেস</p>
        <h1>আপনার জন্য সঠিক শিক্ষক খুঁজে নিন</h1>
        <p>বিষয়, স্তর ও বাজেট অনুযায়ী শিক্ষক বেছে নিন। সুবিধাজনক সময়ে ক্লাস বুক করুন, আর শেখার অগ্রগতি দেখুন এক জায়গায়।</p>
        <form className="searchbar" onSubmit={event => { event.preventDefault(); go(`/search?q=${encodeURIComponent(q)}`); }}>
          <input value={q} onChange={event => setQ(event.target.value)} placeholder="আপনি কী শিখতে চান?" aria-label="আপনি কী শিখতে চান?" />
          <button className="button">শিক্ষক খুঁজুন</button>
        </form>
        <div className="hero-points"><span>✓ যাচাইকৃত শিক্ষক</span><span>✓ স্বচ্ছ মূল্য ও প্যাকেজ</span><span>✓ ইন্টারঅ্যাকটিভ ক্লাসরুম</span></div>
      </div>
      <div className="hero-panel">
        <span className="spark">✦</span>
        <p>আজই শুরু করুন</p>
        <b>বিভিন্ন বিষয়ের শিক্ষক</b>
        <small>বিষয়, স্তর ও বাজেট মিলিয়ে আপনার উপযোগী ক্লাস বেছে নিন</small>
        <a href="#/register" className="button light">বিনামূল্যে শুরু করুন</a>
      </div>
    </section>
    <section className="section">
      <div className="section-head"><div><p className="eyebrow">বিষয় বেছে নিন</p><h2>জনপ্রিয় বিষয়</h2></div><a href="#/search">সব দেখুন →</a></div>
      <div className="categories">{subjects.slice(0, 10).map(subject => <button key={subject.id} onClick={() => go(`/search?subject=${encodeURIComponent(subject.name)}`)}><i>{subject.icon}</i><span>{subject.name}</span><small>{subject.topics.length}টি টপিক</small></button>)}</div>
    </section>
    <section className="section soft">
      <div className="section-head"><div><p className="eyebrow">শিক্ষক নির্বাচন</p><h2>জনপ্রিয় শিক্ষক</h2></div><a href="#/search">সব শিক্ষক দেখুন →</a></div>
      <div className="card-grid">{teachers.map(teacher => <TeacherCard key={teacher.id} teacher={teacher} user={user} compare={compare.some(item => item.id === teacher.id)} onCompare={toggle} />)}</div>
      {compare.length > 1 && <CompareBar teachers={compare} onRemove={toggle} />}
    </section>
    <section className="how">
      <p className="eyebrow">সহজ তিন ধাপ</p><h2>কীভাবে শিক্ষক কাজ করে</h2>
      <div><article><b>১</b><h3>শিক্ষক খুঁজুন</h3><p>বিষয়, স্তর ও বাজেট দিয়ে পছন্দের শিক্ষক বাছুন।</p></article><article><b>২</b><h3>ক্লাস বুক করুন</h3><p>পছন্দের প্যাকেজ ও সময় বেছে বুকিং নিশ্চিত করুন। ফি আগে থেকেই দেখে নিন।</p></article><article><b>৩</b><h3>শিখুন ও এগিয়ে যান</h3><p>ক্লাস, নোট, অনুশীলন ও শেখার অগ্রগতি—সব এক জায়গায়।</p></article></div>
    </section>
  </>;
}
const gigSubjectIcons: Record<string, string> = {
  'গণিত': '∑', 'পদার্থবিজ্ঞান': '⚛', 'রসায়ন': '⚗', 'জীববিজ্ঞান': '✳', 'ইংরেজি': 'Aa',
  'বাংলা': 'অ', 'আইসিটি': '⌘', 'হিসাববিজ্ঞান': '▤', 'ফিন্যান্স': '৳', 'প্রোগ্রামিং': '</>',
  'IELTS': 'IELTS', 'ভর্তি প্রস্তুতি': '✦'
};
const gigSubjectTones: Record<string, string> = {
  'গণিত': 'math', 'পদার্থবিজ্ঞান': 'physics', 'রসায়ন': 'chemistry', 'জীববিজ্ঞান': 'biology',
  'ইংরেজি': 'english', 'বাংলা': 'bangla', 'আইসিটি': 'ict', 'হিসাববিজ্ঞান': 'finance',
  'ফিন্যান্স': 'finance', 'প্রোগ্রামিং': 'programming', 'IELTS': 'ielts', 'ভর্তি প্রস্তুতি': 'admission'
};

export function GigsPage() {
  const [gigs, setGigs] = useState<Gig[] | null>(null);
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('সব গিগ');
  const [sort, setSort] = useState('popular');
  const [visibleCount, setVisibleCount] = useState(12);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void api<Gig[]>('/gigs')
      .then(items => { if (active) setGigs(items); })
      .catch(() => { if (active) { setGigs([]); setError('গিগগুলো এখন লোড করা যাচ্ছে না। আবার চেষ্টা করুন।'); } });
    return () => { active = false; };
  }, [loadAttempt]);

  const startingPackage = (gig: Gig) => [...gig.packages].sort((a, b) => a.price - b.price)[0];

  const subjects = Array.from(new Set((gigs || []).map(gig => gig.subject)));
  const filtered = (gigs || []).filter(gig => {
    const text = `${gig.title} ${gig.description} ${gig.subject} ${gig.topic} ${gig.teacher?.user?.name || ''} ${gig.tags.join(' ')}`.toLocaleLowerCase('bn');
    return (subject === 'সব গিগ' || gig.subject === subject) && (!query.trim() || text.includes(query.trim().toLocaleLowerCase('bn')));
  }).sort((a, b) => {
    if (sort === 'price') return (startingPackage(a)?.price || 0) - (startingPackage(b)?.price || 0);
    if (sort === 'rating') return (b.teacher?.rating || 0) - (a.teacher?.rating || 0) || (b.teacher?.reviewCount || 0) - (a.teacher?.reviewCount || 0);
    if (sort === 'newest') return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    return (b.teacher?.gigViews || 0) - (a.teacher?.gigViews || 0) || (b.teacher?.rating || 0) - (a.teacher?.rating || 0);
  });

  return <section className="page section marketplace-page">
    <div className="gig-market-hero learning-art-header">
      <div className="gig-market-copy">
        <p className="eyebrow">শিখুন নিজের গতিতে</p>
        <h1>দক্ষ শিক্ষকের তৈরি<br/><span>জনপ্রিয় গিগ</span></h1>
        <p className="gig-market-lead">বিষয়ভিত্তিক ক্লাস প্যাকেজ বেছে নিন, শিক্ষকের প্রোফাইল দেখুন, তারপর আপনার সুবিধামতো শেখা শুরু করুন।</p>
        <div className="gig-market-proof"><span><b>{gigs === null ? '—' : bn(gigs.length)}</b>টি শেখার প্যাকেজ</span><i/><span><b>{gigs === null ? '—' : bn(new Set(gigs.map(gig => gig.teacherId)).size)}</b>জন শিক্ষক</span><i/><span>প্যাকেজের মূল্য আগে থেকেই জানা</span></div>
      </div>
      <div className="gig-market-art" aria-hidden="true"><span className="gig-art-orbit orbit-one"/><span className="gig-art-orbit orbit-two"/><span className="gig-art-book">শিখি<br/><b>প্রতিদিন</b></span><span className="gig-art-pencil">✦</span><span className="gig-art-caption">জ্ঞান · অনুশীলন · অগ্রগতি</span></div>
    </div>

    <div className="gig-market-toolbar">
      <div className="gig-market-search"><span aria-hidden="true">⌕</span><input value={query} onChange={event => { setQuery(event.target.value); setVisibleCount(12); }} placeholder="বিষয়, টপিক বা শিক্ষকের নাম খুঁজুন" aria-label="বিষয়, টপিক বা শিক্ষকের নাম খুঁজুন"/>{query && <button type="button" className="gig-market-clear" onClick={() => { setQuery(''); setVisibleCount(12); }} aria-label="খোঁজার লেখা মুছুন">×</button>}<span className="gig-market-hint">বিষয় · টপিক · শিক্ষক</span></div>
      <label className="gig-market-sort"><span>সাজান</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="popular">জনপ্রিয়তা</option><option value="newest">নতুন গিগ</option><option value="rating">শিক্ষকের রেটিং</option><option value="price">কম প্যাকেজ মূল্য</option></select></label>
    </div>

    <div className="gig-market-heading"><div><p className="eyebrow">আপনার শেখার পরের ধাপ</p><h2>শিক্ষকদের শেখার প্যাকেজ</h2></div><span>{gigs === null ? 'লোড হচ্ছে…' : `${bn(filtered.length)}টি গিগ`}</span></div>
    <div className="gig-market-categories" aria-label="বিষয় দিয়ে গিগ বাছাই">
      {['সব গিগ', ...subjects].map(item => <button key={item} className={subject === item ? 'active' : ''} onClick={() => { setSubject(item); setVisibleCount(12); }}>{item === 'সব গিগ' ? 'সব বিষয়' : item}<span>{item === 'সব গিগ' ? bn(gigs?.length || 0) : bn(gigs?.filter(gig => gig.subject === item).length || 0)}</span></button>)}
    </div>

    {gigs === null ? <Loading/> : error ? <div className="gig-market-empty"><span>⌁</span><h3>গিগ লোড হয়নি</h3><p>{error}</p><button className="quiet-btn" onClick={() => { setError(''); setGigs(null); setLoadAttempt(attempt => attempt + 1); }}>আবার চেষ্টা করুন</button></div> : filtered.length ? <>
      <div className="gig-market-grid">{filtered.slice(0, visibleCount).map((gig, index) => {
        const cover = gig.media?.find(media => media.kind === 'IMAGE' && media.cover) || gig.media?.find(media => media.kind === 'IMAGE');
        const firstPackage = startingPackage(gig);
        return <article className="market-gig-card" key={gig.id}>
        <button className={`market-gig-cover tone-${gigSubjectTones[gig.subject] || 'default'}${cover ? ' has-image' : ''}`} onClick={() => go(`/gig/${gig.id}`)} aria-label={`${gig.title} গিগটি দেখুন`}>
          {cover && <img className="market-gig-cover-image" src={cover.url} alt="" aria-hidden="true" loading="lazy"/>}<span className="market-gig-cover-label">{gig.subject} <i>·</i> {gig.level}</span><span className="market-gig-cover-mark">{gigSubjectIcons[gig.subject] || '✦'}</span><span className="market-gig-cover-topic">{gig.topic}</span><span className="market-gig-cover-index">{String(index + 1).padStart(2, '0')}</span>
        </button>
        <div className="market-gig-body">
          <div className="market-gig-tags">{gig.tags.slice(0, 2).map(tag => <span key={tag}>{tag}</span>)}{gig.trial?.enabled && <span className="trial-tag">ট্রায়াল ক্লাস</span>}</div>
          <button className="market-gig-title" onClick={() => go(`/gig/${gig.id}`)}>{gig.title}</button>
          <p className="market-gig-description">{gig.description}</p>
          {firstPackage && <div className="market-gig-package-meta"><span>▦ {bn(firstPackage.classes)}টি ক্লাস</span><i/><span>◷ {bn(firstPackage.duration)} মিনিট</span></div>}
          {gig.teacher && <button className="market-gig-teacher" onClick={() => go(`/teacher/${gig.teacher!.id}`)}><Avatar name={gig.teacher.user.name} size="sm" teacherId={gig.teacher.id} photoUrl={photoFromUser(gig.teacher.user)}/><span className="market-gig-teacher-copy"><b>{gig.teacher.user.name}{gig.teacher.verified && <i aria-label="যাচাইকৃত শিক্ষক">✓</i>}</b><small>{gig.teacher.headline}</small></span><span className="market-gig-rating">{gig.teacher.reviewCount > 0 ? <>★ {gig.teacher.rating.toFixed(1)} <small>({bn(gig.teacher.reviewCount)})</small></> : 'নতুন শিক্ষক'}</span></button>}
          <div className="market-gig-footer"><div><small>{firstPackage ? `${firstPackage.name} প্যাকেজ` : 'প্যাকেজ মূল্য'}</small><b>{money(firstPackage?.price || 0)}</b></div><button className="button" onClick={() => go(`/gig/${gig.id}`)}>গিগ দেখুন <span aria-hidden="true">↗</span></button></div>
        </div>
      </article>;})}</div>
      {visibleCount < filtered.length && <div className="gig-market-more"><button className="quiet-btn" onClick={() => setVisibleCount(count => count + 12)}>আরও গিগ দেখুন <span>↓</span></button><small>{bn(Math.min(visibleCount, filtered.length))} / {bn(filtered.length)}টি গিগ দেখা যাচ্ছে</small></div>}
    </> : <div className="gig-market-empty"><span>⌕</span><h3>এই খোঁজে কোনো গিগ মেলেনি</h3><p>অন্য বিষয় বেছে নিন অথবা খোঁজার শব্দটি বদলে দেখুন।</p><button className="quiet-btn" onClick={() => { setQuery(''); setSubject('সব গিগ'); }}>সব গিগ দেখুন</button></div>}
  </section>;
}
function CompareBar({teachers,onRemove}:{teachers:Teacher[];onRemove:(t:Teacher)=>void}) { return <aside className="compare-bar"><span>{teachers.length} জন শিক্ষক তুলনায় আছে</span>{teachers.map(t=><button key={t.id} onClick={()=>onRemove(t)}>{t.user.name} ×</button>)}<button className="button" onClick={()=>go(`/compare?ids=${teachers.map(t=>t.id).join(',')}`)}>তুলনা দেখুন</button></aside> }

export function Search({user}:{user:User|null}) {
  const params=new URLSearchParams(location.hash.split('?')[1]||'');
  const [subjects,setSubjects]=useState<Subject[]>([]);
  const [q,setQ]=useState(params.get('q')||'');
  const [subject,setSubject]=useState(params.get('subject')||'');
  const [rating,setRating]=useState(params.get('rating')||'');
  const [verified,setVerified]=useState(['true','1'].includes((params.get('verified')||'').toLowerCase()));
  const [teachers,setTeachers]=useState<Teacher[]>([]);
  const [total,setTotal]=useState(0);
  const [page,setPage]=useState(1);
  const [hasMore,setHasMore]=useState(false);
  const [loading,setLoading]=useState(true);
  const [loadingMore,setLoadingMore]=useState(false);
  const [error,setError]=useState('');
  const [compare,setCompare]=useState<Teacher[]>([]);
  const filters={q,subject,rating,verified};
  const hasFilters=Boolean(q.trim()||subject||rating||verified);

  const load=async(nextFilters:{q:string;subject:string;rating:string;verified:boolean}=filters,nextPage=1,append=false)=>{
    setError('');
    if(append)setLoadingMore(true);
    else setLoading(true);
    try {
      const query=new URLSearchParams({...nextFilters,verified:String(nextFilters.verified),page:String(nextPage),perPage:'12'});
      const result=await api<{items:Teacher[];total:number;page:number;perPage:number}>(`/teachers?${query.toString()}`);
      setTeachers(current=>append?[...current,...result.items]:result.items);
      setTotal(result.total);
      setPage(result.page);
      setHasMore(result.page*result.perPage<result.total);
    } catch (e) {
      setError(e instanceof Error?e.message:'শিক্ষকদের তথ্য আনা যায়নি। আবার চেষ্টা করুন।');
      if(!append){setTeachers([]);setTotal(0);setHasMore(false);}
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(()=>{
    void api<Subject[]>('/subjects').then(setSubjects).catch(()=>setSubjects([]));
    void load();
  },[]);

  const matching=async()=>{
    setLoading(true);setLoadingMore(false);setError('');
    try {
      const data=await api<Teacher[]>(`/matches?${new URLSearchParams({subject,q,budget:'700',language:'বাংলা'}).toString()}`);
      setTeachers(data);setTotal(data.length);setPage(1);setHasMore(false);
    } catch (e) {
      setError(e instanceof Error?e.message:'স্মার্ট ম্যাচিং করা যায়নি। আবার চেষ্টা করুন।');
      setTeachers([]);setTotal(0);setHasMore(false);
    } finally {setLoading(false);}
  };

  const reset=()=>{
    const defaults={q:'',subject:'',rating:'',verified:false};
    setQ('');setSubject('');setRating('');setVerified(false);
    void load(defaults);
  };
  const toggle=(teacher:Teacher)=>setCompare(current=>current.some(item=>item.id===teacher.id)?current.filter(item=>item.id!==teacher.id):current.length<3?[...current,teacher]:current);

  return <section className="page section teacher-search-page">
    <header className="teacher-search-intro learning-art-header">
      <div>
        <p className="eyebrow">শিক্ষক মার্কেটপ্লেস</p>
        <h1>আপনার জন্য সঠিক শিক্ষক খুঁজুন</h1>
        <p className="teacher-search-description">বিষয়, অভিজ্ঞতা ও রেটিং মিলিয়ে শিক্ষক বেছে নিন। প্রোফাইল তুলনা করে আপনার শেখা শুরু করুন।</p>
      </div>
      <div className="teacher-search-promise"><span aria-hidden="true">✓</span><div><b>বিশ্বস্ত শিক্ষক</b><small>প্রোফাইল ও অভিজ্ঞতা দেখে বেছে নিন</small></div></div>
    </header>

    <form className="teacher-filter-panel" onSubmit={event=>{event.preventDefault();void load(filters);}}>
      <label className="teacher-search-field">
        <span aria-hidden="true">⌕</span>
        <input type="search" value={q} onChange={event=>setQ(event.target.value)} placeholder="শিক্ষক, বিষয় বা টপিক খুঁজুন" aria-label="শিক্ষক, বিষয় বা টপিক খুঁজুন"/>
      </label>
      <label className="teacher-select-field"><span>বিষয়</span><select value={subject} onChange={event=>setSubject(event.target.value)}><option value="">সব বিষয়</option>{subjects.map(item=><option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
      <label className="teacher-select-field"><span>ন্যূনতম রেটিং</span><select value={rating} onChange={event=>setRating(event.target.value)}><option value="">সব রেটিং</option><option value="4.5">৪.৫ বা বেশি</option><option value="4">৪.০ বা বেশি</option></select></label>
      <div className="teacher-filter-footer">
        <label className="teacher-verified"><input type="checkbox" checked={verified} onChange={event=>setVerified(event.target.checked)}/><span><b>যাচাইকৃত শিক্ষক</b><small>যাচাই করা প্রোফাইল দেখুন</small></span></label>
        <div className="teacher-search-actions">
          <button className="button" disabled={loading||loadingMore}><span aria-hidden="true">⌕</span> শিক্ষক খুঁজুন</button>
          <button type="button" className="quiet-btn" onClick={()=>void matching()} disabled={loading||loadingMore}><span aria-hidden="true">✦</span> স্মার্ট ম্যাচিং</button>
          {hasFilters&&<button type="button" className="teacher-reset" onClick={reset}>ফিল্টার মুছুন</button>}
        </div>
      </div>
    </form>

    <div className="teacher-results-heading" aria-busy={loading||loadingMore}><div><p className="eyebrow">আপনার শেখার সঙ্গী</p><h2>শিক্ষকরা</h2></div><span className="teacher-result-count" role="status" aria-live="polite">{loading?teachers.length?'ফলাফল আপডেট হচ্ছে…':'শিক্ষক খোঁজা হচ্ছে…':loadingMore?'আরও শিক্ষক আসছে…':`${bn(total)} জন শিক্ষক`}</span></div>
    {error&&<p className="teacher-search-error" role="alert">{error}</p>}
    {loading&&teachers.length===0?<Loading/>:teachers.length?<>
      <div className="card-grid teacher-search-results">{teachers.map(teacher=><TeacherCard key={teacher.id} teacher={teacher} user={user} compare={compare.some(item=>item.id===teacher.id)} onCompare={toggle}/>)}</div>
      {hasMore&&<div className="teacher-load-more"><span>{bn(teachers.length)} / {bn(total)} জন শিক্ষক দেখানো হচ্ছে</span><button className="quiet-btn" type="button" disabled={loadingMore} onClick={()=>void load(filters,page+1,true)}>{loadingMore?'আরও শিক্ষক আসছে…':'আরও শিক্ষক দেখুন ↓'}</button></div>}
    </>:!loading&&!error?<div className="teacher-search-empty"><span aria-hidden="true">⌕</span><h3>মিলে যাওয়া শিক্ষক পাওয়া যায়নি</h3><p>খোঁজার শব্দ বা ফিল্টার বদলে আবার চেষ্টা করুন।</p>{hasFilters&&<button className="quiet-btn" type="button" onClick={reset}>সব ফিল্টার মুছুন</button>}</div>:null}
    {compare.length>1&&<CompareBar teachers={compare} onRemove={toggle}/>}
  </section>;
}

export function Compare() {
  const [items, setItems] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    const ids = Array.from(new Set((params.get('ids') || '').split(',').filter(Boolean))).slice(0, 3);
    if (ids.length < 2) { setLoading(false); return; }
    let active = true;
    void Promise.all(ids.map(id => api<Teacher>(`/teachers/${encodeURIComponent(id)}`)))
      .then(teachers => { if (active) setItems(teachers); })
      .catch(() => { if (active) setItems([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <section className="page section compare-page"><Loading /></section>;
  if (items.length < 2) return <section className="page section compare-page"><div className="compare-empty"><span aria-hidden="true">⇄</span><p className="eyebrow">শিক্ষক তুলনা</p><h1>তুলনা করতে শিক্ষক বেছে নিন</h1><p>একসাথে অন্তত দুইজন শিক্ষক নির্বাচন করলে তাঁদের তথ্য এখানে পাশাপাশি দেখতে পাবেন।</p><button className="button" onClick={() => go('/search')}>শিক্ষক খুঁজুন</button></div></section>;

  const rows = [
    { key: 'rating', label: 'রেটিং', render: (teacher: Teacher) => <span className="compare-rating"><b>★ {teacher.rating.toFixed(1)}</b><small>{bn(teacher.reviewCount)} রিভিউ</small></span> },
    { key: 'subjects', label: 'বিষয়', render: (teacher: Teacher) => <span className="compare-value">{teacher.subjects.join(', ')}</span> },
    { key: 'experience', label: 'অভিজ্ঞতা', render: (teacher: Teacher) => <span className="compare-value">{bn(teacher.experienceYears)} বছর</span> },
    { key: 'education', label: 'শিক্ষা', render: (teacher: Teacher) => <span className="compare-education">{teacher.education}<small>{teacher.institution}</small></span> },
    { key: 'classes', label: 'ক্লাস সম্পন্ন', render: (teacher: Teacher) => <span className="compare-value">{bn(teacher.classes)}টি</span> },
    { key: 'students', label: 'শিক্ষার্থী', render: (teacher: Teacher) => <span className="compare-value">{bn(teacher.students)} জন</span> },
    { key: 'rate', label: 'প্রতি ঘণ্টার ফি', render: (teacher: Teacher) => <span className="compare-price">{money(teacher.hourlyRate)}<small> / ঘণ্টা</small></span> },
    { key: 'languages', label: 'ভাষা', render: (teacher: Teacher) => <span className="compare-value">{teacher.languages.join(', ')}</span> },
    { key: 'verified', label: 'যাচাইকরণ', render: (teacher: Teacher) => <span className={`compare-status ${teacher.verified ? 'is-verified' : 'is-pending'}`}>{teacher.verified ? '✓ যাচাইকৃত' : 'যাচাই চলছে'}</span> }
  ];

  return <section className="page section compare-page">
    <div className="compare-heading learning-art-header"><div><p className="eyebrow">শিক্ষক তুলনা</p><h1>শিক্ষক নির্বাচন সহজ করুন</h1><p>রেটিং, অভিজ্ঞতা, শিক্ষা ও ফি পাশাপাশি মিলিয়ে দেখুন।</p></div><span className="compare-count"><b>{bn(items.length)}</b> জন শিক্ষক</span></div>
    <div className="compare-table-wrap" role="region" aria-label="শিক্ষক তুলনার ছক" tabIndex={0}>
      <table className="compare-table" aria-label="শিক্ষক তুলনা">
        <thead><tr><th scope="col" className="compare-topic"><span>তুলনার বিষয়</span><small>প্রয়োজনীয় তথ্য</small></th>{items.map(teacher => <th scope="col" key={teacher.id}><div className="compare-person"><Avatar name={teacher.user.name} size="lg" teacherId={teacher.id} photoUrl={photoFromUser(teacher.user)}/><div className="compare-person-info"><b>{teacher.user.name}</b><p>{teacher.headline}</p><span className={`compare-status ${teacher.verified ? 'is-verified' : 'is-pending'}`}>{teacher.verified ? '✓ যাচাইকৃত' : 'যাচাই চলছে'}</span></div></div></th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.key}><th scope="row">{row.label}</th>{items.map(teacher => <td key={`${row.key}-${teacher.id}`}>{row.render(teacher)}</td>)}</tr>)}</tbody>
      </table>
    </div>
    <p className="compare-hint">মোবাইলে ছকটি পাশের দিকে সরিয়ে অন্য শিক্ষক দেখুন। আরও শিক্ষক যোগ করতে শিক্ষক খোঁজার পাতায় ফিরে যান।</p>
  </section>;
}

export function TeacherPage({user}:{user:User|null}) { const id=location.hash.split('/')[2]?.split('?')[0];const [teacher,setTeacher]=useState<Teacher|null>(null);const [booking,setBooking]=useState<Gig|null>(null);useEffect(()=>{if(id)void api<Teacher>(`/teachers/${id}`).then(setTeacher);},[id]);useEffect(()=>{if(!teacher)return;let secondFrame=0;const firstFrame=requestAnimationFrame(()=>{secondFrame=requestAnimationFrame(()=>window.scrollTo(0,0));});return()=>{cancelAnimationFrame(firstFrame);cancelAnimationFrame(secondFrame);};},[teacher]);if(!teacher)return <Loading/>;return <section className="page"><div className="profile-hero learning-art-header"><Avatar name={teacher.user.name} size="lg" teacherId={teacher.id} photoUrl={photoFromUser(teacher.user)}/><div><p className="eyebrow">{teacher.level}</p><h1>{teacher.user.name} {teacher.verified&&<em className="verified">✓ যাচাইকৃত</em>}</h1><p>{teacher.headline}</p><div className="profile-stats"><span>★ {teacher.rating} রেটিং</span><span>{teacher.experienceYears} বছরের অভিজ্ঞতা</span><span>{money(teacher.hourlyRate)} / ঘণ্টা</span></div></div><div className="profile-cta"><button className="button" onClick={()=>teacher.gigs?.[0]&&setBooking(teacher.gigs[0])}>ক্লাস বুক করুন</button><button className="quiet-btn" onClick={()=>go(user?.role==='STUDENT'?`/messages?with=${encodeURIComponent(teacher.user.id)}`:'/messages')}>বার্তা পাঠান</button></div></div><div className="profile-layout"><div className="profile-content"><Info title="পরিচিতি"><p>{teacher.bio}</p></Info><Info title="শিক্ষাগত যোগ্যতা"><p>{teacher.education} — {teacher.institution}</p></Info><Info title="বিষয় ও দক্ষতা"><div className="chips">{[...teacher.subjects,...teacher.skills].map(x=><span key={x}>{x}</span>)}</div></Info><Info title="পড়ানোর পদ্ধতি"><p>লাইভ ইন্টারঅ্যাক্টিভ ক্লাস, উদাহরণভিত্তিক ব্যাখ্যা এবং ক্লাস-পরবর্তী নোট।</p></Info><Info title="শিক্ষকের পাঠের ভিডিও">{teacher.demoUrl?<iframe className="video" src={teacher.demoUrl} title="শিক্ষকের পাঠের ভিডিও" allowFullScreen/>:<Empty>শিক্ষক এখনো কোনো পাঠের ভিডিও যুক্ত করেননি।</Empty>}</Info><Info title="শিক্ষকের গিগ স্টোরফ্রন্ট"><div className="teacher-gig-storefront">{teacher.gigs?.map(g=><TeacherGigCard key={g.id} gig={g} onBook={()=>setBooking(g)}/>)}</div></Info></div><aside className="aside-card"><h3>সময়সূচি</h3>{Object.entries(teacher.availability).map(([d,t])=><p key={d}><b>{d}</b><br/>{t.join(' • ')}</p>)}<hr/><p>ভাষা: {teacher.languages.join(', ')}</p><p>অবস্থান: {teacher.location}</p></aside></div>{booking&&(user?.role==='STUDENT'?<BookingModal gig={booking} onClose={()=>setBooking(null)} onDone={bid=>go(`/payment/${bid}`)}/>:<LoginHint onClose={()=>setBooking(null)}/>)}</section> }

function TeacherGigCard({gig,onBook}:{gig:Gig;onBook:()=>void}) { return <article className="teacher-gig-card"><div className="teacher-gig-card-head"><div><span className="preview-badge">{gig.subject} · {gig.level}</span><h3>{gig.title}</h3><p>{gig.description}</p></div><strong>{gig.badges?.[0]||'শিক্ষক সেবা'}</strong></div><div className="chips">{gig.tags.map(tag=><span key={tag}>{tag}</span>)}{gig.classType&&<span>{gig.classType}</span>}{gig.duration&&<span>{bn(gig.duration)} মিনিট</span>}{gig.trial?.enabled&&<span>ট্রায়াল ক্লাস</span>}</div>{gig.outcomes?.length&&<div className="gig-detail-block"><b>শিক্ষার্থী যা শিখবেন</b><ul>{gig.outcomes.filter(Boolean).map(outcome=><li key={outcome}>{outcome}</li>)}</ul></div>}<div className="gig-package-grid">{gig.packages.map(pack=><div className="teacher-gig-package" key={pack.id}><b>{pack.name}</b><span>{bn(pack.classes)}টি ক্লাস · {bn(pack.duration)} মিনিট</span><strong>{money(pack.price)}</strong><small>{pack.features.join(' · ')}</small></div>)}</div>{gig.extras?.length&&<div className="gig-detail-block"><b>অতিরিক্ত সেবা</b><p>{gig.extras.map(extra=>`${extra.name} (${money(extra.price)})`).join(' · ')}</p></div>}{gig.media?.length&&<div className="gig-detail-block"><b>মিডিয়া ও উপকরণ</b><p>{gig.media.map(media=>media.caption||media.kind).join(' · ')}</p></div>}{gig.faqs.length>0&&<details className="gig-faq"><summary>সচরাচর জিজ্ঞাসা ({bn(gig.faqs.length)})</summary>{gig.faqs.map(faq=><p key={faq.q}><b>{faq.q}</b><br/>{faq.a}</p>)}</details>}<div className="teacher-gig-footer"><span>{gig.availability&&Object.keys(gig.availability).length?`উপলভ্য: ${Object.keys(gig.availability).join(', ')}`:'সময় শিক্ষককে জিজ্ঞাসা করুন'}</span><button className="button" onClick={onBook}>প্যাকেজ বেছে বুক করুন</button></div></article> }
function Info({title,children}:{title:string;children:React.ReactNode}) {return <section className="info"><h2>{title}</h2>{children}</section>}
function LoginHint({onClose}:{onClose:()=>void}){return <div className="modal-back"><section className="modal"><button className="close" onClick={onClose}>×</button><h2>বুকিং করতে লগইন করুন</h2><p>ক্লাস বুক করতে শিক্ষার্থী হিসেবে লগইন বা নিবন্ধন করুন।</p><button className="button wide" onClick={()=>go('/login')}>লগইন করুন</button></section></div>}

export function GigPage({user}:{user:User|null}) {
  const id=location.hash.split('/')[2]?.split('?')[0];
  const [gig,setGig]=useState<Gig|null>(null);
  const [booking,setBooking]=useState(false);
  const [selectedPackageId,setSelectedPackageId]=useState('');
  const [loadError,setLoadError]=useState('');
  const [loadAttempt,setLoadAttempt]=useState(0);
  useEffect(()=>{
    let active=true;
    setGig(null);
    setLoadError('');
    if(!id){setLoadError('গিগের ঠিকানাটি সঠিক নয়।');return()=>{active=false;};}
    void api<Gig>(`/gigs/${id}`).then(item=>{if(active)setGig(item);}).catch(()=>{if(active)setLoadError('এই গিগটি এখন দেখানো যাচ্ছে না। আবার চেষ্টা করুন।');});
    return()=>{active=false;};
  },[id,loadAttempt]);
  const selectedPackage=gig?.packages.find(item=>item.id===selectedPackageId)||gig?.packages[0];
  if(loadError)return <section className="page gig-detail-page"><div className="gig-detail-empty"><span aria-hidden="true">⌁</span><h1>গিগটি পাওয়া যাচ্ছে না</h1><p>{loadError}</p><div><button className="button" onClick={()=>{setLoadError('');setLoadAttempt(attempt=>attempt+1);}}>আবার চেষ্টা করুন</button><button className="quiet-btn" onClick={()=>go('/gigs')}>সব গিগ দেখুন</button></div></div></section>;
  if(!gig)return <Loading/>;
  const teacher=gig.teacher;
  const cover=gig.media?.find(media=>media.kind==='IMAGE'&&media.cover)||gig.media?.find(media=>media.kind==='IMAGE');
  const outcomes=gig.outcomes?.filter(Boolean)||[];
  return <section className="page gig-detail-page">
    <a className="gig-detail-back" href="#/gigs"><span aria-hidden="true">←</span> সব গিগ দেখুন</a>
    <header className="gig-detail-hero learning-art-header">
      <div className="gig-detail-copy">
        <div className="gig-detail-kicker"><span>{gig.subject}</span><i/>{gig.level&&<span>{gig.level}</span>}{gig.language&&<span>{gig.language} মাধ্যমে</span>}{gig.trial?.enabled&&<span className="gig-trial-pill">ট্রায়াল ক্লাস</span>}</div>
        <h1>{gig.title}</h1>
        <p className="gig-detail-lead">{gig.description}</p>
        {teacher&&<div className="gig-detail-teacher">
          <Avatar name={teacher.user?.name||'শিক্ষক'} size="md" teacherId={teacher.id} photoUrl={photoFromUser(teacher.user)}/>
          <div className="gig-detail-teacher-copy"><span>শিক্ষক</span><b>{teacher.user?.name||'অভিজ্ঞ শিক্ষক'}{teacher.verified&&<i aria-label="যাচাইকৃত শিক্ষক">✓</i>}</b><small>{teacher.headline}</small></div>
          <div className="gig-detail-teacher-rating">{teacher.reviewCount>0?<><b>★ {teacher.rating.toFixed(1)}</b><small>{bn(teacher.reviewCount)}টি রিভিউ</small></>:<small>নতুন শিক্ষক</small>}</div>
        </div>}
      </div>
      <div className={`gig-detail-art${cover?' has-image':''}`}>
        {cover?<img src={cover.url} alt="" aria-hidden="true"/>:<div className="gig-detail-art-symbol" aria-hidden="true">{gigSubjectIcons[gig.subject]||'✦'}</div>}
        <div className="gig-detail-art-caption"><span>{gig.subject}</span><b>{gig.topic}</b><small>বুঝে শিখুন · অনুশীলনে এগিয়ে যান</small></div>
      </div>
    </header>

    {teacher&&<div className="gig-detail-stats" aria-label="শিক্ষকের তথ্য">
      {teacher.reviewCount>0&&<div><b>★ {teacher.rating.toFixed(1)}</b><span>{bn(teacher.reviewCount)}টি রিভিউ</span></div>}
      <div><b>{bn(teacher.classes)}</b><span>টি ক্লাস সম্পন্ন</span></div>
      <div><b>{bn(teacher.students)}</b><span>জন শিক্ষার্থী</span></div>
      <div><b>{bn(teacher.experienceYears)}</b><span>বছরের অভিজ্ঞতা</span></div>
      {teacher.location&&<div><b>{teacher.location}</b><span>শিক্ষকের অবস্থান</span></div>}
    </div>}

    <div className="gig-detail-layout">
      <div className="gig-detail-main">
        {gig.demoUrl&&<section className="gig-detail-section gig-detail-preview"><p className="eyebrow">ক্লাসের পরিচিতি</p><h2>শিক্ষকের পাঠ দেখুন</h2><iframe className="video" src={gig.demoUrl} title="শিক্ষকের পাঠের ভিডিও" allowFullScreen/></section>}
        {outcomes.length>0&&<section className="gig-detail-section"><p className="eyebrow">শেখার লক্ষ্য</p><h2>এই ক্লাসে যা শিখবেন</h2><ul className="gig-detail-checklist">{outcomes.map(outcome=><li key={outcome}><span aria-hidden="true">✓</span>{outcome}</li>)}</ul></section>}
        <section className="gig-detail-section"><p className="eyebrow">ক্লাসের অন্তর্ভুক্ত</p><h2>যা যা পাবেন</h2><ul className="gig-detail-checklist">{gig.includes.map(item=><li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul></section>
        {gig.requirements&&<section className="gig-detail-section gig-requirements"><p className="eyebrow">শুরু করার আগে</p><h2>আপনার যা লাগবে</h2><p>{gig.requirements}</p></section>}
        {gig.faqs.length>0&&<section className="gig-detail-section gig-detail-faq"><p className="eyebrow">সহায়তা</p><h2>সচরাচর জিজ্ঞাসা</h2>{gig.faqs.map(item=><details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}</section>}
        {teacher&&<section className="gig-detail-teacher-card"><div><p className="eyebrow">আপনার শিক্ষক</p><h2>{teacher.user?.name||'অভিজ্ঞ শিক্ষক'}</h2><p>{teacher.bio||teacher.headline}</p><div className="gig-detail-teacher-facts">{teacher.education&&<span>{teacher.education}</span>}{teacher.institution&&<span>{teacher.institution}</span>}{teacher.languages?.length>0&&<span>{teacher.languages.join(' · ')}</span>}</div></div><button className="quiet-btn" onClick={()=>go(`/teacher/${teacher.id}`)}>শিক্ষকের প্রোফাইল <span aria-hidden="true">↗</span></button></section>}
      </div>

      <aside className="gig-detail-packages">
        <div className="gig-detail-package-heading"><p className="eyebrow">আপনার শেখার পরিকল্পনা</p><h2>প্যাকেজ বেছে নিন</h2><p>প্রতিটি প্যাকেজে কী থাকছে ও মোট মূল্য আগে দেখে নিন।</p></div>
        <div className="gig-package-options" aria-label="ক্লাস প্যাকেজ">
          {gig.packages.map((item,index)=>{
            const active=selectedPackage?.id===item.id;
            return <article className={`gig-package-option${active?' selected':''}`} key={item.id}>
              <div className="gig-package-option-top"><div><span>প্যাকেজ {bn(index+1)}</span><h3>{item.name}</h3></div><b>{money(item.price)}</b></div>
              <p className="gig-package-meta">{bn(item.classes)}টি ক্লাস <i/> {bn(item.duration)} মিনিট করে</p>
              <ul>{item.features.map(feature=><li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul>
              <button type="button" className="gig-package-select" aria-pressed={active} onClick={()=>setSelectedPackageId(item.id)}>{active?'✓ নির্বাচিত':'এই প্যাকেজ বেছে নিন'}</button>
            </article>;
          })}
        </div>
        <div className="gig-detail-booking">
          <div><span>নির্বাচিত প্যাকেজের মোট</span><b>{money(selectedPackage?.price||0)}</b></div>
          <button className="button wide" disabled={!selectedPackage} onClick={()=>setBooking(true)}>এই প্যাকেজে বুক করুন <span aria-hidden="true">→</span></button>
          <small>বুকিং নিশ্চিত করার আগে সময় বেছে নিতে পারবেন।</small>
        </div>
      </aside>
    </div>
    {booking&&(user?.role==='STUDENT'?<BookingModal gig={gig} initialPackageId={selectedPackage?.id} onClose={()=>setBooking(false)} onDone={bookingId=>go(`/payment/${bookingId}`)}/>:<LoginHint onClose={()=>setBooking(false)}/>)}
  </section>;
}

export function AuthPage({ kind, onLogin }: { kind: 'login' | 'register'; onLogin: (user: User) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('STUDENT');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const chooseDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('demo123');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = kind === 'login'
        ? await post<User>('/auth/login', { email, password })
        : await post<User>('/auth/register', { name, email, password, role });
      onLogin(user);
      const requestedRoute = location.hash.startsWith('#/') ? location.hash.slice(1) : '';
      go(requestedRoute && !['/login', '/register', '/'].includes(requestedRoute) ? requestedRoute : '/dashboard');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'সমস্যা হয়েছে');
    } finally {
      setBusy(false);
    }
  };

  const joinDemoClass = async (demoEmail: string) => {
    setBusy(true);
    setError('');
    try {
      const user = await post<User>('/auth/login', { email: demoEmail, password: 'demo123' });
      onLogin(user);
      go('/classroom/booking-demo-live');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ডেমো ক্লাসে প্রবেশ করা যায়নি।');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`auth-page ${kind === 'login' ? 'is-login' : 'is-register'}`}>
      <aside className="auth-aside">
        <div className="auth-intro">
          <h1 className="auth-wordmark" aria-label="Private Tutor">
            <span>Private</span> <b>Tutor</b><i aria-hidden="true" />
          </h1>
          <p className="eyebrow auth-demo-label"><span aria-hidden="true" />শেখা ও শেখানোর নির্ভরযোগ্য ঠিকানা</p>
          <h2>শেখা ও শেখানোর সহজ শুরু</h2>
          <p className="auth-description">শিক্ষার্থী, শিক্ষক, অভিভাবক বা অ্যাডমিন—নিজের ভূমিকা বেছে নিয়ে শিখোকের সুবিধাগুলো ব্যবহার করুন। এই পরিবেশে বাস্তব অর্থ লেনদেন চালু নেই।</p>
        </div>

        <section className="demo-account-panel" aria-labelledby="demo-account-title">
          <div className="demo-account-heading">
            <div>
              <h3 id="demo-account-title">দ্রুত প্রবেশের জন্য ভূমিকা বেছে নিন</h3>
              <p>একটি বাছলে লগইন তথ্য বসবে—তারপর লগইন করুন।</p>
            </div>
            <span className="demo-count">
              <span className="demo-avatar-stack" aria-hidden="true">
                <img src="/images/teachers/teacher-01.svg" alt="" />
                <img src="/images/teachers/teacher-02.svg" alt="" />
                <img src="/images/teachers/teacher-03.svg" alt="" />
                <img src="/images/teachers/teacher-04.svg" alt="" />
              </span>
              <span>৪টি প্রোফাইল</span>
            </span>
          </div>
          <div className="demo-accounts">
            <button type="button" onClick={() => chooseDemo('student@demo.local')}>
              <img className="demo-role-avatar" src="/images/teachers/teacher-01.svg" alt="" aria-hidden="true" />
              <span className="demo-role-copy"><b>শিক্ষার্থী</b><small>শিখতে শুরু করুন</small></span>
              <span className="demo-role-arrow" aria-hidden="true">↗</span>
            </button>
            <button type="button" onClick={() => chooseDemo('teacher@demo.local')}>
              <img className="demo-role-avatar" src="/images/teachers/teacher-02.svg" alt="" aria-hidden="true" />
              <span className="demo-role-copy"><b>শিক্ষক</b><small>শিক্ষক ড্যাশবোর্ড</small></span>
              <span className="demo-role-arrow" aria-hidden="true">↗</span>
            </button>
            <button type="button" onClick={() => chooseDemo('parent@demo.local')}>
              <img className="demo-role-avatar" src="/images/teachers/teacher-03.svg" alt="" aria-hidden="true" />
              <span className="demo-role-copy"><b>অভিভাবক</b><small>শেখার অগ্রগতি দেখুন</small></span>
              <span className="demo-role-arrow" aria-hidden="true">↗</span>
            </button>
            <button type="button" onClick={() => chooseDemo('admin@demo.local')}>
              <img className="demo-role-avatar" src="/images/teachers/teacher-04.svg" alt="" aria-hidden="true" />
              <span className="demo-role-copy"><b>অ্যাডমিন</b><small>প্ল্যাটফর্ম পরিচালনা</small></span>
              <span className="demo-role-arrow" aria-hidden="true">↗</span>
            </button>
          </div>
          {kind === 'login' && <section className="demo-classroom-actions" aria-label="ডেমো লাইভ ক্লাসে যোগ দিন">
            <b>ডেমো লাইভ ক্লাসে যোগ দিন</b>
            <p>দুই পক্ষকে একসঙ্গে দেখতে শিক্ষার্থী ও শিক্ষককে আলাদা ব্রাউজার বা ডিভাইসে খুলুন।</p>
            <div>
              <button type="button" disabled={busy} onClick={() => void joinDemoClass('student@demo.local')}>শিক্ষার্থী হিসেবে যোগ দিন</button>
              <button type="button" disabled={busy} onClick={() => void joinDemoClass('teacher@demo.local')}>শিক্ষক হিসেবে যোগ দিন</button>
            </div>
          </section>}
        </section>
      </aside>

      <div className="auth-form">
        <p className="eyebrow">{kind === 'login' ? 'আপনার অ্যাকাউন্টে প্রবেশ করুন' : 'নতুন অ্যাকাউন্ট'}</p>
        <h2>{kind === 'login' ? 'লগইন করুন' : 'নিবন্ধন করুন'}</h2>
        <p className="auth-form-intro">{kind === 'login' ? 'আপনার শেখা বা শেখানোর যাত্রা চালিয়ে যান।' : 'Private Tutor-এ আপনার অ্যাকাউন্ট তৈরি করুন।'}</p>
        <form onSubmit={submit}>
          {kind === 'register' && <>
            <label>পূর্ণ নাম<input value={name} onChange={event => setName(event.target.value)} autoComplete="name" required /></label>
            <label>আমি একজন<select value={role} onChange={event => setRole(event.target.value)}><option value="STUDENT">শিক্ষার্থী</option><option value="TEACHER">শিক্ষক</option><option value="PARENT">অভিভাবক</option></select></label>
          </>}
          <label>ইমেইল<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label>পাসওয়ার্ড<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={kind === 'login' ? 'current-password' : 'new-password'} required minLength={6} /></label>
          {kind === 'login' && <p className="help">একটি ভূমিকা বেছে নিলে লগইন তথ্য স্বয়ংক্রিয়ভাবে এখানে বসবে।</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button wide" disabled={busy}>{busy ? 'অপেক্ষা করুন…' : kind === 'login' ? 'লগইন করুন' : 'অ্যাকাউন্ট তৈরি করুন'}</button>
        </form>
        <p className="auth-switch">{kind === 'login' ? 'অ্যাকাউন্ট নেই?' : 'ইতোমধ্যে নিবন্ধিত?'} <a href={kind === 'login' ? '#/register' : '#/login'}>{kind === 'login' ? 'নিবন্ধন করুন' : 'লগইন করুন'}</a></p>
      </div>
    </section>
  );
}

type DashboardData={user:User;bookings:Booking[];notifications:Notification[];unread:number;teacher?:Teacher;wallet?:{total:number;pending:number;commission:number;entries:any[]};gigs?:Gig[];analytics?:Record<string,number>;favorites?:any[];attempts?:any[];children?:{name:string;bookings:Booking[];attempts:any[]}[];admin?:{users:number;teachers:number;pending:number;payments:number;reports:number}};
export function Dashboard({user,onUserUpdated}:{user:User;onUserUpdated?:(user:User)=>void}) {
  const [data,setData]=useState<DashboardData|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const load=async()=>{
    setLoading(true);setError('');
    try {setData(await api<DashboardData>('/dashboard'));}
    catch (e) {setError(e instanceof Error?e.message:'ড্যাশবোর্ড লোড করা যায়নি। আবার চেষ্টা করুন।');}
    finally {setLoading(false);}
  };
  useEffect(()=>{void load();},[]);
  if(!data&&loading)return <Loading/>;
  if(!data)return <section className="page section dashboard-error"><p className="eyebrow">শিক্ষার্থী ড্যাশবোর্ড</p><h1>ড্যাশবোর্ড লোড হয়নি</h1><p>{error||'তথ্য আনতে সমস্যা হয়েছে।'}</p><button className="button" onClick={()=>void load()}>আবার চেষ্টা করুন</button></section>;
  if(user.role==='TEACHER')return <TeacherDashboard data={data}/>;
  if(user.role==='PARENT')return <ParentDashboard data={data}/>;
  if(user.role==='ADMIN'||user.role==='SUPER_ADMIN')return <AdminDashboard data={data}/>;
  return <StudentDashboard data={data} onUserUpdated={onUserUpdated}/>;
}
const BookingList=({bookings}:{bookings:Booking[]})=><div className="booking-list">{bookings.slice(0,5).map(b=><article key={b.id}><span className={`status ${b.status}`}>{statusBn(b.status)}</span><div><b>{shortDate(b.date)} • {b.time}</b><p>{money(b.price)} • বুকিং #{b.id.slice(-5)}</p></div><div className="booking-actions">{['CONFIRMED','IN_PROGRESS'].includes(b.status)&&<button className="button small" onClick={()=>go(`/classroom/${b.id}`)}>ক্লাসে যান</button>}<button className="quiet-btn" onClick={()=>go(`/booking/${b.id}`)}>বিস্তারিত</button></div></article>)}</div>;
const Stat=({label,value,accent}:{label:string;value:string|number;accent?:string})=><article className="stat"><small>{label}</small><b className={accent}>{value}</b></article>;
function StudentDashboard({data,onUserUpdated}:{data:DashboardData;onUserUpdated?:(user:User)=>void}) {
  const [profileOpen,setProfileOpen]=useState(false);
  const completed=data.bookings.filter(booking=>booking.status==='COMPLETED').length;
  const attempts=data.attempts||[];
  const average=attempts.length?Math.round(attempts.reduce((sum,attempt)=>sum+(attempt.total?attempt.score/attempt.total:0),0)/attempts.length*100):0;
  const upcoming=data.bookings
    .filter(booking=>['CONFIRMED','IN_PROGRESS'].includes(booking.status))
    .sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0];
  const quickLinks=[
    {icon:'⌕',title:'শিক্ষক খুঁজুন',description:'আপনার বিষয়ের শিক্ষক বেছে নিন',path:'/search',tone:'mint'},
    {icon:'✎',title:'Exam Name',description:'নিজের পছন্দে MCQ পরীক্ষা দিন',path:'/mcq-exam',tone:'lilac'},
    {icon:'◈',title:'সমস্যা সমাধান',description:'প্রশ্ন শেয়ার করে সহায়তা নিন',path:'/problems',tone:'peach'},
    {icon:'✉',title:'বার্তা দেখুন',description:'শিক্ষকের সঙ্গে কথা বলুন',path:'/messages',tone:'blue'}
  ];
  const dateLabel=new Intl.DateTimeFormat('bn-BD',{dateStyle:'full'}).format(new Date());

  return <section className="page section student-dashboard">
    <header className="student-welcome learning-art-header">
      <div className="student-welcome-copy">
        <div className="student-welcome-identity">
          <Avatar name={data.user.name} size="lg" photoUrl={photoFromUser(data.user)}/>
          <div className="student-welcome-identity-copy"><p className="eyebrow">শিক্ষার্থী ড্যাশবোর্ড</p><h1>স্বাগতম, {data.user.name}</h1></div>
          <button className="quiet-btn student-welcome-edit" onClick={()=>setProfileOpen(true)}>প্রোফাইল সম্পাদনা</button>
        </div>
        <p>আজ কী শিখবেন? আপনার ক্লাস, পরীক্ষা ও শিক্ষকের সঙ্গে যোগাযোগ—সব এক জায়গায় রাখুন।</p>
        <span className="student-date"><span aria-hidden="true">◷</span>{dateLabel}</span>
      </div>
      <div className="student-welcome-card">
        <span className="student-welcome-icon" aria-hidden="true">✦</span>
        <small>শেখা শুরু করুন</small>
        <b>আপনার পরের সেরা ক্লাসটি খুঁজে নিন</b>
        <button className="button" onClick={()=>go('/search')}>শিক্ষক খুঁজুন <span aria-hidden="true">→</span></button>
      </div>
      <span className="student-welcome-orbit" aria-hidden="true">✧</span>
    </header>

    <div className="student-overview" aria-label="শেখার সারসংক্ষেপ">
      <article className="student-metric metric-mint"><span aria-hidden="true">▣</span><div><small>মোট ক্লাস</small><b>{bn(data.bookings.length)}</b><em>আপনার বুকিং</em></div></article>
      <article className="student-metric metric-green"><span aria-hidden="true">✓</span><div><small>সম্পন্ন ক্লাস</small><b>{bn(completed)}</b><em>শেখার অগ্রগতি</em></div></article>
      <article className="student-metric metric-lilac"><span aria-hidden="true">✎</span><div><small>পরীক্ষার গড়</small><b>{attempts.length?`${bn(average)}%`:'—'}</b><em>{attempts.length?`${bn(attempts.length)}টি পরীক্ষা`:'এখনও পরীক্ষা হয়নি'}</em></div></article>
      <article className="student-metric metric-peach"><span aria-hidden="true">♡</span><div><small>সংরক্ষিত শিক্ষক</small><b>{bn(data.favorites?.length||0)}</b><em>আপনার পছন্দ</em></div></article>
    </div>

    <McqProgressCard />

    <section className="student-quick-section" aria-labelledby="student-quick-title">
      <div className="student-section-heading"><div><p className="eyebrow">এক ট্যাপেই</p><h2 id="student-quick-title">দ্রুত কাজ</h2></div><span>আপনার দরকারি সেবা</span></div>
      <div className="student-quick-grid">{quickLinks.map(item=><button className="student-quick-card" key={item.path} onClick={()=>go(item.path)}><span className={`student-quick-icon ${item.tone}`} aria-hidden="true">{item.icon}</span><span className="student-quick-copy"><b>{item.title}</b><small>{item.description}</small></span><span className="student-quick-arrow" aria-hidden="true">→</span></button>)}</div>
    </section>

    <div className="student-content-grid">
      <section className="student-panel student-classes">
        <header className="student-panel-heading"><div><p className="eyebrow">আপনার সময়সূচি</p><h2>আসন্ন ও সাম্প্রতিক ক্লাস</h2></div><a href="#/bookings">সব বুকিং <span aria-hidden="true">→</span></a></header>
        {upcoming&&<article className="student-next-class">
          <div className="student-next-icon" aria-hidden="true">▣</div>
          <div className="student-next-copy"><span className={`student-next-status ${upcoming.status==='IN_PROGRESS'?'is-live':''}`}>{upcoming.status==='IN_PROGRESS'?'● লাইভ ক্লাস চলছে':'পরবর্তী ক্লাস'}</span><b>{shortDate(upcoming.date)} <span>•</span> {upcoming.time}</b><small>বুকিং #{upcoming.id.slice(-5)} <span>·</span> {money(upcoming.price)}</small></div>
          <button className={upcoming.status==='IN_PROGRESS'?'button':'quiet-btn'} onClick={()=>go(`/classroom/${upcoming.id}`)}>{upcoming.status==='IN_PROGRESS'?'লাইভ ক্লাসে যোগ দিন':'ক্লাসে যোগ দিন'}</button>
        </article>}
        {data.bookings.length>0?<BookingList bookings={upcoming?data.bookings.filter(booking=>booking.id!==upcoming.id):data.bookings}/>:<div className="student-empty-state"><span aria-hidden="true">▣</span><b>এখনও কোনো ক্লাস বুক করা নেই</b><p>আপনার পছন্দের শিক্ষক খুঁজে প্রথম ক্লাসটি বুক করুন।</p><button className="quiet-btn" onClick={()=>go('/search')}>শিক্ষক দেখুন</button></div>}
      </section>

      <section className="student-panel student-notifications">
        <header className="student-panel-heading"><div><p className="eyebrow">আপডেট</p><h2>সাম্প্রতিক নোটিফিকেশন</h2></div>{data.unread>0&&<span className="student-unread">{bn(data.unread)}টি নতুন</span>}</header>
        <Notifications items={data.notifications}/>
        {data.notifications.length>0&&<a className="student-all-notifications" href="#/notifications">সব নোটিফিকেশন <span aria-hidden="true">→</span></a>}
      </section>
    </div>
    {profileOpen&&<StudentProfileEditor user={data.user} onClose={()=>setProfileOpen(false)} onSaved={()=>window.location.reload()} onUserSaved={onUserUpdated}/>}
  </section>;
}
function TeacherDashboard({data}:{data:DashboardData}){const [profileOpen,setProfileOpen]=useState(false);const liveBooking=data.bookings.find(b=>['CONFIRMED','IN_PROGRESS'].includes(b.status));return <section className="page section"><p className="eyebrow">শিক্ষক ড্যাশবোর্ড</p><h1>স্বাগতম, {data.user.name}</h1><div className="stats"><Stat label="প্রোফাইল দেখা হয়েছে" value={bn(data.analytics?.profileViews||0)}/><Stat label="গিগ দেখা হয়েছে" value={bn(data.analytics?.gigViews||0)}/><Stat label="নিশ্চিত বুকিং" value={bn(data.bookings.filter(b=>b.status==='CONFIRMED').length)} accent="green"/><Stat label="অপেক্ষমাণ আয়" value={money(data.wallet?.pending||0)} accent="purple"/></div><div className="dashboard-grid"><Info title="আজকের বুকিং"><BookingList bookings={data.bookings}/><a href="#/bookings">সব বুকিং দেখুন →</a></Info><Info title="দ্রুত কাজ"><div className="stack">{liveBooking&&<button className="button wide" onClick={()=>go(`/classroom/${liveBooking.id}`)}>লাইভ ক্লাসে যোগ দিন</button>}<button className="button wide" onClick={()=>go('/teacher/exams/new')}>নতুন পরীক্ষা তৈরি করুন</button><button className="quiet-btn wide" onClick={()=>go('/teacher/exams')}>পরীক্ষা পরিচালনা করুন</button><button className="button wide" onClick={()=>go('/teacher/gigs/new')}>নতুন গিগ তৈরি করুন</button><button className="quiet-btn wide" onClick={()=>setProfileOpen(true)}>প্রোফাইল ও সময়সূচি সম্পাদনা</button><button className="quiet-btn wide" onClick={()=>go('/wallet')}>আয় ও লেনদেন দেখুন</button></div></Info></div><Info title="আমার গিগ">{data.gigs?.length?<div className="gig-list">{data.gigs.map(g=><article key={g.id}><div><b>{g.title}</b><p>{money(g.packages[0].price)} থেকে</p></div><button className="quiet-btn" onClick={()=>go(`/gig/${g.id}`)}>দেখুন</button></article>)}</div>:<Empty>এখনও কোনো গিগ নেই।</Empty>}</Info>{profileOpen&&<ProfileForm teacher={data.teacher!} onClose={()=>setProfileOpen(false)}/>}</section>}
function ParentDashboard({data}:{data:DashboardData}){return <section className="page section"><p className="eyebrow">অভিভাবক ড্যাশবোর্ড</p><h1>সন্তানের শেখার অগ্রগতি</h1>{data.children?.length?data.children.map(c=><div className="child-card" key={c.name}><div><Avatar name={c.name}/><h2>{c.name}</h2></div><div><b>{bn(c.bookings.length)}</b><small>মোট ক্লাস</small></div><div><b>{bn(c.attempts.length)}</b><small>পরীক্ষা</small></div><button className="button" onClick={()=>go('/bookings')}>বিস্তারিত দেখুন</button></div>):<Empty>এখনও কোনো শিক্ষার্থী যুক্ত করা হয়নি।</Empty>}<Info title="শেখার খরচের সারাংশ"><p>সন্তানের বুকিং, পরিশোধের অবস্থা ও শেখার খরচের বিবরণ এখানে দেখুন।</p><button className="quiet-btn" onClick={()=>go('/bookings')}>বুকিং ইতিহাস দেখুন</button></Info></section>}
type AdminUserRecord=User&{createdAt?:string;active?:boolean};
type AdminGig=Gig&{teacher?:Teacher};
type AdminPayment={id:string;bookingId:string;studentId:string;amount:number;status:'PAID'|'REFUNDED';transactionId:string;createdAt:string;student:User;booking?:Booking};
type AdminReport={id:string;reporterId:string;subjectType:string;subjectId:string;reason:string;status:'OPEN'|'RESOLVED';createdAt:string;reporter:User};
type AdminAuditEntry={id:string;actorId:string;action:string;entity:string;entityId:string;at:string;actor:User};

const adminRoleName=(role:string)=>({STUDENT:'শিক্ষার্থী',TEACHER:'শিক্ষক',PARENT:'অভিভাবক',ADMIN:'অ্যাডমিন',SUPER_ADMIN:'সুপার অ্যাডমিন'}[role]||role);
const adminActionName=(action:string)=>({verification_APPROVED:'শিক্ষক যাচাই অনুমোদন',verification_REJECTED:'শিক্ষক যাচাই প্রত্যাখ্যান',verification_PENDING:'পুনরায় যাচাইয়ের জন্য পাঠানো',report_RESOLVED:'রিপোর্ট সমাধান',report_OPEN:'রিপোর্ট পুনরায় খোলা',gig_moderation_APPROVED:'গিগ প্রকাশ অনুমোদন',gig_moderation_REJECTED:'গিগ প্রত্যাখ্যান'}[action]||action.replaceAll('_',' '));

function AdminDashboard({data}:{data:DashboardData}){
  const [pending,setPending]=useState<Teacher[]|null>(null);
  const [pendingGigs,setPendingGigs]=useState<AdminGig[]|null>(null);
  const [bookingCount,setBookingCount]=useState<number|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const load=async()=>{
    setLoading(true);setError('');
    try{
      const [teachers,gigs,bookings]=await Promise.all([api<Teacher[]>('/admin/teachers/pending'),api<AdminGig[]>('/admin/gigs/pending'),api<Booking[]>('/bookings')]);
      setPending(teachers);setPendingGigs(gigs);setBookingCount(bookings.length);
    }catch(e){setError(e instanceof Error?e.message:'অ্যাডমিন তথ্য আনা যায়নি। আবার চেষ্টা করুন।');}
    finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[]);
  const moderate=async(kind:'teacher'|'gig',id:string,status:'APPROVED'|'REJECTED')=>{
    const key=`${kind}:${id}`;setBusy(key);setError('');setNotice('');
    try{
      if(kind==='teacher')await post(`/admin/teachers/${id}/verification`,{status});
      else await post(`/admin/gigs/${id}/moderation`,{status,note:status==='APPROVED'?'অ্যাডমিন পর্যালোচনায় অনুমোদিত':'অ্যাডমিন পর্যালোচনায় প্রত্যাখ্যাত'});
      setNotice(status==='APPROVED'?'পর্যালোচনা সম্পন্ন হয়েছে।':'আইটেমটি প্রত্যাখ্যান করা হয়েছে।');
      await load();
    }catch(e){setError(e instanceof Error?e.message:'পর্যালোচনা সম্পন্ন হয়নি। আবার চেষ্টা করুন।');}
    finally{setBusy('');}
  };
  const jump=(id:string)=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});
  const modules=[
    {icon:'♙',title:'ব্যবহারকারী',detail:'অ্যাকাউন্ট ও ভূমিকা দেখুন',count:bn(data.admin?.users||0),tone:'mint',action:()=>go('/admin/users')},
    {icon:'✓',title:'শিক্ষক যাচাই',detail:'অপেক্ষমাণ প্রোফাইল পর্যালোচনা',count:pending?bn(pending.length):'…',tone:'green',action:()=>jump('admin-teacher-review')},
    {icon:'✦',title:'গিগ মডারেশন',detail:'নতুন গিগ প্রকাশের আগে যাচাই',count:pendingGigs?bn(pendingGigs.length):'…',tone:'lilac',action:()=>jump('admin-gig-review')},
    {icon:'▣',title:'সব বুকিং',detail:'ক্লাস ও বুকিংয়ের অবস্থা',count:bookingCount===null?'…':bn(bookingCount),tone:'blue',action:()=>go('/bookings')},
    {icon:'⚑',title:'রিপোর্ট',detail:'সমাধানের অপেক্ষায় থাকা রিপোর্ট',count:bn(data.admin?.reports||0),tone:'peach',action:()=>go('/admin/reports')},
    {icon:'৳',title:'পেমেন্ট ইতিহাস',detail:'পরীক্ষামূলক লেনদেন পর্যালোচনা',count:bn(data.admin?.payments||0),tone:'green',action:()=>go('/admin/payments')},
    {icon:'◷',title:'অ্যাডমিন কার্যক্রম',detail:'সাম্প্রতিক সিদ্ধান্ত ও পরিবর্তন',count:'লগ',tone:'blue',action:()=>go('/admin/audit')},
    {icon:'◈',title:'সমস্যা সমাধান',detail:'শিক্ষার্থীদের প্রশ্ন ও সহায়তা',count:'খুলুন',tone:'peach',action:()=>go('/problems')},
    {icon:'⌕',title:'মার্কেটপ্লেস',detail:'শিক্ষক ও গিগের তালিকা দেখুন',count:'খুলুন',tone:'mint',action:()=>go('/search')}
  ];
  return <section className="page section admin-dashboard">
    <header className="admin-welcome learning-art-header"><div><p className="eyebrow">অ্যাডমিন কন্ট্রোল সেন্টার</p><h1>স্বাগতম, {data.user.name}</h1><p>ব্যবহারকারী, ক্লাস ও কনটেন্ট—প্ল্যাটফর্মের সব ব্যবস্থাপনা এক জায়গায়।</p></div><button className="quiet-btn admin-refresh" type="button" onClick={()=>void load()} disabled={loading}>↻ {loading?'আপডেট হচ্ছে…':'ড্যাশবোর্ড আপডেট'}</button><span className="admin-welcome-orbit" aria-hidden="true">✦</span></header>
    <div className="admin-metrics" aria-label="প্ল্যাটফর্মের সারসংক্ষেপ">
      <article className="admin-metric metric-mint"><span>♙</span><div><small>মোট ব্যবহারকারী</small><b>{bn(data.admin?.users||0)}</b><em>সব ভূমিকা মিলিয়ে</em></div></article>
      <article className="admin-metric metric-blue"><span>▣</span><div><small>শিক্ষক প্রোফাইল</small><b>{bn(data.admin?.teachers||0)}</b><em>মার্কেটপ্লেসে</em></div></article>
      <article className="admin-metric metric-lilac"><span>✓</span><div><small>শিক্ষক যাচাই বাকি</small><b>{pending?bn(pending.length):loading?'…':bn(data.admin?.pending||0)}</b><em>পর্যালোচনা দরকার</em></div></article>
      <article className="admin-metric metric-peach"><span>✦</span><div><small>গিগ অনুমোদন বাকি</small><b>{pendingGigs?bn(pendingGigs.length):'…'}</b><em>প্রকাশের আগে</em></div></article>
      <article className="admin-metric metric-green"><span>▤</span><div><small>মোট বুকিং</small><b>{bookingCount===null?'…':bn(bookingCount)}</b><em>সব ক্লাস মিলিয়ে</em></div></article>
      <article className="admin-metric metric-lilac"><span>⚑</span><div><small>খোলা রিপোর্ট</small><b>{bn(data.admin?.reports||0)}</b><em>পর্যালোচনা দরকার</em></div></article>
      <article className="admin-metric metric-blue"><span>৳</span><div><small>পরীক্ষামূলক লেনদেন</small><b>{bn(data.admin?.payments||0)}</b><em>বাস্তব লেনদেন নয়</em></div></article>
    </div>

    <section className="admin-module-section" aria-labelledby="admin-module-title"><div className="admin-section-heading"><div><p className="eyebrow">সব অপশন</p><h2 id="admin-module-title">প্ল্যাটফর্ম ব্যবস্থাপনা</h2></div><span>আপনার ভূমিকা: {data.user.role==='SUPER_ADMIN'?'সুপার অ্যাডমিন':'অ্যাডমিন'}</span></div><div className="admin-module-grid">{modules.map(item=><button key={item.title} className="admin-module-card" type="button" onClick={item.action}><span className={`admin-module-icon ${item.tone}`} aria-hidden="true">{item.icon}</span><span className="admin-module-copy"><b>{item.title}</b><small>{item.detail}</small></span><span className="admin-module-count">{item.count}</span><span className="admin-module-arrow" aria-hidden="true">→</span></button>)}</div></section>

    {error&&<p className="admin-feedback is-error" role="alert">{error}<button type="button" onClick={()=>void load()}>আবার চেষ্টা করুন</button></p>}
    {notice&&<p className="admin-feedback is-success" role="status">{notice}</p>}
    <div className="admin-review-grid">
      <section className="admin-review-panel" id="admin-teacher-review"><header className="admin-section-heading"><div><p className="eyebrow">পর্যালোচনা কেন্দ্র</p><h2>শিক্ষক যাচাই</h2></div><span className="admin-queue-count">{pending?bn(pending.length):'…'} বাকি</span></header>{loading&&pending===null?<Loading/>:pending?.length?<div className="admin-review-list">{pending.map(teacher=><article className="admin-review-card" key={teacher.id}><div className="admin-review-person"><Avatar name={teacher.user.name} size="md" teacherId={teacher.id} photoUrl={photoFromUser(teacher.user)}/><div><b>{teacher.user.name}</b><p>{teacher.headline}</p></div></div><div className="admin-review-meta"><span>{teacher.education||'শিক্ষাগত তথ্য অসম্পূর্ণ'}</span><span>{teacher.institution||'প্রতিষ্ঠান উল্লেখ নেই'}</span><span>{teacher.subjects.slice(0,3).join(' · ')||'বিষয় যোগ করা হয়নি'}</span></div><a className="admin-text-link" href={`#/teacher/${teacher.id}`}>প্রোফাইল দেখুন ↗</a><div className="admin-review-actions"><button className="button small" type="button" disabled={busy===`teacher:${teacher.id}`} onClick={()=>void moderate('teacher',teacher.id,'APPROVED')}>{busy===`teacher:${teacher.id}`?'অপেক্ষা…':'অনুমোদন'}</button><button className="danger-btn" type="button" disabled={busy===`teacher:${teacher.id}`} onClick={()=>void moderate('teacher',teacher.id,'REJECTED')}>প্রত্যাখ্যান</button></div></article>)}</div>:<Empty>এখন কোনো শিক্ষক যাচাইয়ের অপেক্ষায় নেই।</Empty>}</section>
      <section className="admin-review-panel" id="admin-gig-review"><header className="admin-section-heading"><div><p className="eyebrow">কনটেন্ট মডারেশন</p><h2>গিগ অনুমোদন</h2></div><span className="admin-queue-count">{pendingGigs?bn(pendingGigs.length):'…'} বাকি</span></header>{loading&&pendingGigs===null?<Loading/>:pendingGigs?.length?<div className="admin-review-list">{pendingGigs.map(gig=><article className="admin-review-card" key={gig.id}><div className="admin-gig-heading"><div><b>{gig.title}</b><p>{gig.subject} · {gig.topic}</p></div><span>{money(gig.packages?.[0]?.price||0)} থেকে</span></div><p className="admin-gig-description">{gig.description}</p><div className="admin-review-meta"><span>শিক্ষক: {gig.teacher?.user.name||gig.teacherId}</span><span>জমা: {shortDate(gig.createdAt)}</span></div><a className="admin-text-link" href={`#/gig/${gig.id}`}>গিগ প্রিভিউ ↗</a><div className="admin-review-actions"><button className="button small" type="button" disabled={busy===`gig:${gig.id}`} onClick={()=>void moderate('gig',gig.id,'APPROVED')}>{busy===`gig:${gig.id}`?'অপেক্ষা…':'অনুমোদন'}</button><button className="danger-btn" type="button" disabled={busy===`gig:${gig.id}`} onClick={()=>void moderate('gig',gig.id,'REJECTED')}>প্রত্যাখ্যান</button></div></article>)}</div>:<Empty>এখন কোনো গিগ অনুমোদনের অপেক্ষায় নেই।</Empty>}</section>
    </div>
  </section>;
}

function AdminPageHeading({eyebrow,title,description}:{eyebrow:string;title:string;description:string}){return <header className="admin-page-heading learning-art-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div><button className="quiet-btn" type="button" onClick={()=>go('/dashboard')}>← ড্যাশবোর্ড</button></header>}

export function AdminUsers(){
  const [users,setUsers]=useState<AdminUserRecord[]|null>(null);const [query,setQuery]=useState('');const [role,setRole]=useState('ALL');const [error,setError]=useState('');
  const load=async()=>{setError('');try{setUsers(await api<AdminUserRecord[]>('/admin/users'));}catch(e){setError(e instanceof Error?e.message:'ব্যবহারকারীর তালিকা আনা যায়নি।');}};
  useEffect(()=>{void load();},[]);
  const filtered=(users||[]).filter(user=>(role==='ALL'||user.role===role)&&`${user.name} ${user.email}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="page section admin-page"><AdminPageHeading eyebrow="অ্যাকাউন্ট ডিরেক্টরি" title="ব্যবহারকারী তালিকা" description="শিক্ষার্থী, শিক্ষক, অভিভাবক ও অ্যাডমিন অ্যাকাউন্ট দেখুন।"/><div className="admin-page-toolbar"><label><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="নাম বা ইমেইল দিয়ে খুঁজুন" aria-label="নাম বা ইমেইল দিয়ে খুঁজুন"/></label><select value={role} onChange={event=>setRole(event.target.value)} aria-label="ভূমিকা অনুযায়ী ফিল্টার"><option value="ALL">সব ভূমিকা</option><option value="STUDENT">শিক্ষার্থী</option><option value="TEACHER">শিক্ষক</option><option value="PARENT">অভিভাবক</option><option value="ADMIN">অ্যাডমিন</option><option value="SUPER_ADMIN">সুপার অ্যাডমিন</option></select><span>{users?`${bn(filtered.length)} / ${bn(users.length)} জন`: 'তথ্য লোড হচ্ছে…'}</span></div>{error&&<p className="admin-feedback is-error" role="alert">{error}<button type="button" onClick={()=>void load()}>আবার চেষ্টা করুন</button></p>}{!users&&!error?<Loading/>:filtered.length?<div className="admin-user-grid">{filtered.map(user=><article className="admin-user-card" key={user.id}><div className="admin-user-avatar">{user.name.trim().slice(0,1)}</div><div className="admin-user-copy"><b>{user.name}</b><a href={`mailto:${user.email}`}>{user.email}</a></div><span className={`admin-role-badge role-${user.role.toLowerCase()}`}>{adminRoleName(user.role)}</span><div className="admin-user-meta"><span className={user.active===false?'is-inactive':'is-active'}>{user.active===false?'নিষ্ক্রিয়':'সক্রিয়'}</span>{user.createdAt&&<small>যোগ দিয়েছেন {shortDate(user.createdAt)}</small>}</div></article>)}</div>:<Empty>এই ফিল্টারে কোনো ব্যবহারকারী পাওয়া যায়নি।</Empty>}</section>;
}

export function AdminPayments(){
  const [items,setItems]=useState<AdminPayment[]|null>(null);const [query,setQuery]=useState('');const [status,setStatus]=useState('ALL');const [error,setError]=useState('');
  const load=async()=>{setError('');try{setItems(await api<AdminPayment[]>('/admin/payments'));}catch(e){setError(e instanceof Error?e.message:'পেমেন্ট ইতিহাস আনা যায়নি।');}};
  useEffect(()=>{void load();},[]);
  const filtered=(items||[]).filter(item=>(status==='ALL'||item.status===status)&&`${item.student.name} ${item.transactionId} ${item.bookingId}`.toLowerCase().includes(query.trim().toLowerCase()));
  const paid=(items||[]).filter(item=>item.status==='PAID').reduce((sum,item)=>sum+item.amount,0);
  return <section className="page section admin-page"><AdminPageHeading eyebrow="লেনদেন তদারকি" title="পেমেন্ট ইতিহাস" description="লেনদেনের রসিদ ও বুকিংয়ের তথ্য দেখুন। এখানে বাস্তব অর্থ স্থানান্তর চালু নেই।"/><div className="admin-small-metrics"><Stat label="মোট লেনদেন" value={bn(items?.length||0)}/><Stat label="সম্পন্ন পরীক্ষামূলক পেমেন্ট" value={bn((items||[]).filter(item=>item.status==='PAID').length)} accent="green"/><Stat label="পরীক্ষামূলক আদায়" value={money(paid)} accent="purple"/></div><div className="admin-page-toolbar"><label><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="শিক্ষার্থী, ট্রানজ্যাকশন বা বুকিং আইডি" aria-label="শিক্ষার্থী, ট্রানজ্যাকশন বা বুকিং আইডি"/></label><select value={status} onChange={event=>setStatus(event.target.value)} aria-label="পেমেন্টের অবস্থা"><option value="ALL">সব অবস্থা</option><option value="PAID">সম্পন্ন</option><option value="REFUNDED">ফেরত দেওয়া</option></select><span>{items?`${bn(filtered.length)}টি রেকর্ড`: 'তথ্য লোড হচ্ছে…'}</span></div>{error&&<p className="admin-feedback is-error" role="alert">{error}<button type="button" onClick={()=>void load()}>আবার চেষ্টা করুন</button></p>}{!items&&!error?<Loading/>:filtered.length?<div className="admin-record-list">{filtered.map(item=><article className="admin-record-card" key={item.id}><div><small>ট্রানজ্যাকশন</small><b>{item.transactionId}</b><span>{item.student.name} · {item.student.email}</span></div><div><small>বুকিং</small><b>#{item.bookingId.slice(-8)}</b><span>{item.booking?`${shortDate(item.booking.date)} · ${item.booking.time}`:'তথ্য নেই'}</span></div><div><small>তারিখ ও অবস্থা</small><b>{shortDate(item.createdAt)}</b><span className={`admin-status ${item.status==='PAID'?'is-success':''}`}>{item.status==='PAID'?'সম্পন্ন':'ফেরত'}</span></div><strong>{money(item.amount)}</strong></article>)}</div>:<Empty>এই ফিল্টারে কোনো পেমেন্ট পাওয়া যায়নি।</Empty>}</section>;
}

export function AdminReports(){
  const [items,setItems]=useState<AdminReport[]|null>(null);const [filter,setFilter]=useState('OPEN');const [busy,setBusy]=useState('');const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const load=async()=>{setError('');try{setItems(await api<AdminReport[]>('/admin/reports'));}catch(e){setError(e instanceof Error?e.message:'রিপোর্টের তালিকা আনা যায়নি।');}};
  useEffect(()=>{void load();},[]);
  const update=async(report:AdminReport,status:'OPEN'|'RESOLVED')=>{setBusy(report.id);setError('');setNotice('');try{await post(`/admin/reports/${report.id}/status`,{status});setItems(current=>current?.map(item=>item.id===report.id?{...item,status}:item)||[]);setNotice(status==='RESOLVED'?'রিপোর্টটি সমাধান হিসেবে চিহ্নিত হয়েছে।':'রিপোর্টটি আবার খোলা হয়েছে।');}catch(e){setError(e instanceof Error?e.message:'রিপোর্ট আপডেট হয়নি।');}finally{setBusy('');}};
  const filtered=(items||[]).filter(item=>filter==='ALL'||item.status===filter);
  return <section className="page section admin-page"><AdminPageHeading eyebrow="নিরাপত্তা ও সহায়তা" title="ব্যবহারকারীর রিপোর্ট" description="রিপোর্ট পর্যালোচনা করুন এবং সমাধান হলে তার অবস্থা হালনাগাদ করুন।"/><div className="admin-page-toolbar"><div className="admin-filter-pills"><button className={filter==='OPEN'?'active':''} onClick={()=>setFilter('OPEN')}>খোলা ({bn((items||[]).filter(item=>item.status==='OPEN').length)})</button><button className={filter==='RESOLVED'?'active':''} onClick={()=>setFilter('RESOLVED')}>সমাধান হয়েছে</button><button className={filter==='ALL'?'active':''} onClick={()=>setFilter('ALL')}>সব</button></div><span>{items?`${bn(filtered.length)}টি রিপোর্ট`: 'তথ্য লোড হচ্ছে…'}</span></div>{error&&<p className="admin-feedback is-error" role="alert">{error}<button type="button" onClick={()=>void load()}>আবার চেষ্টা করুন</button></p>}{notice&&<p className="admin-feedback is-success" role="status">{notice}</p>}{!items&&!error?<Loading/>:filtered.length?<div className="admin-record-list">{filtered.map(report=><article className="admin-report-card" key={report.id}><header><div><span className={`admin-status ${report.status==='OPEN'?'is-open':'is-success'}`}>{report.status==='OPEN'?'খোলা':'সমাধান হয়েছে'}</span><h2>{report.subjectType} · {report.subjectId}</h2></div><small>{shortDate(report.createdAt)}</small></header><p>{report.reason}</p><div className="admin-record-footer"><span>রিপোর্ট করেছেন: <b>{report.reporter.name}</b> · {report.reporter.email}</span>{report.status==='OPEN'?<button className="button small" type="button" disabled={busy===report.id} onClick={()=>void update(report,'RESOLVED')}>{busy===report.id?'আপডেট হচ্ছে…':'সমাধান হিসেবে চিহ্নিত'}</button>:<button className="quiet-btn" type="button" disabled={busy===report.id} onClick={()=>void update(report,'OPEN')}>আবার খুলুন</button>}</div></article>)}</div>:<Empty>{filter==='OPEN'?'এখন কোনো খোলা রিপোর্ট নেই।':'এই ফিল্টারে কোনো রিপোর্ট পাওয়া যায়নি।'}</Empty>}</section>;
}

export function AdminAudit(){
  const [items,setItems]=useState<AdminAuditEntry[]|null>(null);const [error,setError]=useState('');
  const load=async()=>{setError('');try{setItems(await api<AdminAuditEntry[]>('/admin/audit'));}catch(e){setError(e instanceof Error?e.message:'অ্যাডমিন কার্যক্রম আনা যায়নি।');}};
  useEffect(()=>{void load();},[]);
  return <section className="page section admin-page"><AdminPageHeading eyebrow="নিরাপত্তা ও জবাবদিহি" title="অ্যাডমিন কার্যক্রম" description="শিক্ষক যাচাই, রিপোর্ট ও কনটেন্ট মডারেশনের সাম্প্রতিক সিদ্ধান্তগুলো দেখুন।"/>{error&&<p className="admin-feedback is-error" role="alert">{error}<button type="button" onClick={()=>void load()}>আবার চেষ্টা করুন</button></p>}{!items&&!error?<Loading/>:items?.length?<div className="admin-record-list">{items.map(item=><article className="admin-audit-card" key={item.id}><span className="admin-audit-icon" aria-hidden="true">◷</span><div><b>{adminActionName(item.action)}</b><p>{item.entity} · {item.entityId}</p><small>{item.actor.name} · {shortDate(item.at)}</small></div><span className="admin-role-badge">{item.actor.role==='SUPER_ADMIN'?'সুপার অ্যাডমিন':'অ্যাডমিন'}</span></article>)}</div>:<Empty>এখনও কোনো অ্যাডমিন কার্যক্রম রেকর্ড হয়নি।</Empty>}</section>;
}
function Notifications({items}:{items:Notification[]}){return items.length?<ul className="notice-list">{items.slice(0,5).map(n=><li key={n.id}><b>{n.title}</b><p>{n.body}</p><small>{shortDate(n.createdAt)}</small></li>)}</ul>:<Empty>নতুন কোনো নোটিফিকেশন নেই।</Empty>}
function ProfileForm({teacher,onClose}:{teacher:Teacher;onClose:()=>void}){const [form,setForm]=useState({headline:teacher.headline,bio:teacher.bio,education:teacher.education,institution:teacher.institution,location:teacher.location,hourlyRate:String(teacher.hourlyRate),sessionPrice:String(teacher.sessionPrice ?? teacher.hourlyRate),demoUrl:teacher.demoUrl,availability:Object.entries(teacher.availability||{}).map(([day,slots])=>`${day}: ${slots.join(', ')}`).join('\n')});const [message,setMessage]=useState('');const parseAvailability=(raw:string)=>{const next:Record<string,string[]>={};for(const line of raw.split(/\n|;/).map(x=>x.trim()).filter(Boolean)){const idx=line.indexOf(':');if(idx<0)continue;const day=line.slice(0,idx).trim();const slots=line.slice(idx+1).split(',').map(v=>v.trim()).filter(Boolean);if(day)next[day]=slots;}return next;};const save=async(e:React.FormEvent)=>{e.preventDefault();const availability=parseAvailability(form.availability);await put('/teacher/availability',{sessionPrice:Number(form.sessionPrice),availability});setMessage('প্রোফাইল ও লাইভ সময়সূচি সফলভাবে সংরক্ষিত হয়েছে।');};return <div className="modal-back"><section className="modal"><button className="close" onClick={onClose}>×</button><h2>প্রোফাইল সম্পাদনা</h2><form onSubmit={save}><label>শিরোনাম<input value={form.headline} onChange={e=>setForm({...form,headline:e.target.value})}/></label><label>পরিচিতি<textarea value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})}/></label><div className="two"><label>শিক্ষা<input value={form.education} onChange={e=>setForm({...form,education:e.target.value})}/></label><label>প্রতিষ্ঠান<input value={form.institution} onChange={e=>setForm({...form,institution:e.target.value})}/></label></div><div className="two"><label>অবস্থান<input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label><label>প্রতি ঘণ্টার মূল্য<input type="number" value={form.hourlyRate} onChange={e=>setForm({...form,hourlyRate:e.target.value})}/></label></div><div className="two"><label>সেশন ফি<input type="number" value={form.sessionPrice} onChange={e=>setForm({...form,sessionPrice:e.target.value})}/></label><label>লাইভ স্ট্যাটাস<input value={teacher.isLive ? 'লাইভ' : 'অফলাইনে'} readOnly/></label></div><label>সময়সূচি (যেমন: সোমবার: ১০:০০, ১৬:০০)<textarea value={form.availability} onChange={e=>setForm({...form,availability:e.target.value})} rows={5}/></label><label>শিক্ষকের পাঠের ভিডিও URL<input value={form.demoUrl} onChange={e=>setForm({...form,demoUrl:e.target.value})}/></label>{message&&<p className="success">{message}</p>}<button className="button wide">সংরক্ষণ করুন</button></form></section></div>}
function GigForm({onClose}:{onClose:()=>void}){const [f,setF]=useState({title:'',description:'',subject:'',topic:'',level:'HSC',price:'500'});const [message,setMessage]=useState('');const save=async(e:React.FormEvent)=>{e.preventDefault();await post('/teacher/gigs',{...f,price:Number(f.price)});setMessage('নতুন গিগ তৈরি হয়েছে।');};return <div className="modal-back"><section className="modal"><button className="close" onClick={onClose}>×</button><h2>নতুন গিগ তৈরি করুন</h2><form onSubmit={save}><label>শিরোনাম<input value={f.title} onChange={e=>setF({...f,title:e.target.value})} required/></label><label>বর্ণনা<textarea value={f.description} onChange={e=>setF({...f,description:e.target.value})} required/></label><div className="two"><label>বিষয়<input value={f.subject} onChange={e=>setF({...f,subject:e.target.value})} required/></label><label>টপিক<input value={f.topic} onChange={e=>setF({...f,topic:e.target.value})} required/></label></div><div className="two"><label>শিক্ষার স্তর<input value={f.level} onChange={e=>setF({...f,level:e.target.value})} required/></label><label>বেসিক মূল্য<input type="number" value={f.price} onChange={e=>setF({...f,price:e.target.value})} required/></label></div>{message&&<p className="success">{message}</p>}<button className="button wide">গিগ প্রকাশ করুন</button></form></section></div>}

void GigForm;
const statusBn=(status:string)=>({PENDING:'অপেক্ষমাণ',CONFIRMED:'নিশ্চিত',IN_PROGRESS:'চলমান',COMPLETED:'সম্পন্ন',CANCELLED:'বাতিল',NO_SHOW:'উপস্থিত হয়নি',DISPUTED:'বিরোধপূর্ণ',REFUNDED:'ফেরত দেওয়া হয়েছে'}[status]||status);
export function Bookings({user}:{user:User}) { const [items,setItems]=useState<Booking[]|null>(null);const [notes,setNotes]=useState<Record<string,string>>({});const load=()=>void api<Booking[]>('/bookings').then(setItems);useEffect(load,[]);const status=async(b:Booking,s:string)=>{await post(`/bookings/${b.id}/status`,{status:s});load();};const saveNote=async(b:Booking)=>{await post(`/bookings/${b.id}/notes`,{notes:notes[b.id]});load();};if(!items)return <Loading/>;return <section className="page section"><p className="eyebrow">ক্লাস ব্যবস্থাপনা</p><h1>{user.role==="ADMIN"||user.role==="SUPER_ADMIN"?"সব বুকিং":"আমার বুকিং"}</h1>{items.length?<div className="full-bookings">{items.map(b=><article key={b.id}><div className="booking-top"><div><span className={`status ${b.status}`}>{statusBn(b.status)}</span><h3>{shortDate(b.date)} • {b.time}</h3><p>{money(b.price)} • আইডি: {b.id.slice(-8)}</p></div><div className="booking-actions">{user.role==='STUDENT'&&b.status==='PENDING'&&<button className="button" onClick={()=>go(`/payment/${b.id}`)}>পেমেন্ট করুন</button>}{['CONFIRMED','IN_PROGRESS'].includes(b.status)&&<button className="button" onClick={()=>go(`/classroom/${b.id}`)}>ক্লাসরুম</button>}{user.role==='TEACHER'&&b.status==='CONFIRMED'&&<button className="quiet-btn" onClick={()=>void status(b,'IN_PROGRESS')}>ক্লাস শুরু</button>}{user.role==='TEACHER'&&b.status==='IN_PROGRESS'&&<button className="quiet-btn" onClick={()=>void status(b,'COMPLETED')}>ক্লাস শেষ</button>}</div></div><div className="history">{b.history.map(h=><span key={h.at}>{statusBn(h.status)} · {shortDate(h.at)}</span>)}</div>{b.notes&&<div className="note-box"><b>ক্লাস নোট</b><p>{b.notes}</p></div>}{b.recording&&<div className="note-box"><b>এই ডিভাইসে রেকর্ড করা ক্লাস</b><p>{b.recording.name} · {bn(b.recording.duration)} সেকেন্ড</p></div>}{user.role==='TEACHER'&&<form className="inline-form" onSubmit={e=>{e.preventDefault();void saveNote(b)}}><input value={notes[b.id]||''} onChange={e=>setNotes({...notes,[b.id]:e.target.value})} placeholder="ক্লাস নোট যোগ করুন"/><button className="quiet-btn">নোট সংরক্ষণ</button></form>}{user.role==='STUDENT'&&b.status==='COMPLETED'&&<ReviewForm booking={b}/>}</article>)}</div>:<Empty>এখনও কোনো বুকিং নেই। পছন্দের শিক্ষক খুঁজে ক্লাস বুক করুন।</Empty>}</section> }
function ReviewForm({booking}:{booking:Booking}){const [comment,setComment]=useState('');const [rating,setRating]=useState('5');const [message,setMessage]=useState('');const submit=async(e:React.FormEvent)=>{e.preventDefault();try{await post('/reviews',{bookingId:booking.id,rating:Number(rating),comment});setMessage('আপনার রিভিউ সংরক্ষিত হয়েছে।');}catch(e){setMessage(e instanceof Error?e.message:'সমস্যা হয়েছে');}};return <form className="review-form" onSubmit={submit}><b>ক্লাসের রিভিউ দিন</b><select value={rating} onChange={e=>setRating(e.target.value)}>{[5,4,3,2,1].map(x=><option key={x} value={x}>{x} তারকা</option>)}</select><input value={comment} onChange={e=>setComment(e.target.value)} placeholder="আপনার অভিজ্ঞতা লিখুন" required/>{message?<p className="success">{message}</p>:<button className="quiet-btn">রিভিউ জমা দিন</button>}</form>}

export function PaymentPage({user}:{user:User}){const bookingId=location.hash.split('/')[2];const [booking,setBooking]=useState<Booking|null>(null);const [done,setDone]=useState<any>(null);const [error,setError]=useState('');useEffect(()=>{void api<Booking[]>('/bookings').then(b=>setBooking(b.find(x=>x.id===bookingId)||null));},[bookingId]);const pay=async()=>{setError('');try{setDone(await post(`/bookings/${bookingId}/pay`));}catch(e){setError(e instanceof Error?e.message:'সমস্যা হয়েছে');}};if(!booking)return <Loading/>;if(user.role!=='STUDENT')return <section className="page section"><Empty>বুকিংয়ের ফি পরিশোধের ধাপে যেতে শিক্ষার্থী হিসেবে প্রবেশ করুন।</Empty></section>;if(done)return <section className="page section receipt"><span className="receipt-icon">✓</span><p className="eyebrow">পরীক্ষামূলক বুকিং সম্পন্ন</p><h1>আপনার বুকিং নিশ্চিত হয়েছে</h1><p>{shortDate(booking.date)} তারিখে {booking.time} টার ক্লাসটি বুক করা হয়েছে।</p><div><span>লেনদেন আইডি</span><b>{done.receipt.transactionId}</b><span>পরিমাণ</span><b>{money(done.receipt.amount)}</b></div><p className="notice">এই পরীক্ষামূলক বুকিংয়ে কোনো বাস্তব অর্থ লেনদেন হয়নি।</p><button className="button" onClick={()=>go('/bookings')}>আমার বুকিং দেখুন</button></section>;return <section className="page section payment"><p className="eyebrow">ধাপ ২ / ২</p><h1>পরীক্ষামূলক অর্থপ্রদান নিশ্চিত করুন</h1><div className="payment-card"><div><h3>বুকিং সারাংশ</h3><p>{shortDate(booking.date)} • {booking.time}</p><p>বুকিং আইডি: {booking.id.slice(-8)}</p></div><b>{money(booking.price)}</b></div><div className="demo-box"><span>🧪</span><div><h3>পরীক্ষামূলক অর্থপ্রদান</h3><p>এই ধাপটি বুকিংয়ের অভিজ্ঞতা দেখায়; আপনার কাছ থেকে কোনো অর্থ নেওয়া হবে না।</p></div></div>{error&&<p className="form-error">{error}</p>}<button className="button wide" onClick={()=>void pay()}>পরীক্ষামূলক অর্থপ্রদান নিশ্চিত করুন</button></section>}

export function Wallet(){const [data,setData]=useState<{total:number;pending:number;commission:number;entries:any[]}|null>(null);const [message,setMessage]=useState('');const load=()=>void api<typeof data>('/wallet').then(x=>setData(x as any));useEffect(load,[]);if(!data)return <Loading/>;const payout=async()=>{try{const r=await post<{message:string;amount:number}>('/wallet/payout');setMessage(`${r.message} (${money(r.amount)})`);load();}catch(e){setMessage(e instanceof Error?e.message:'সমস্যা হয়েছে');}};return <section className="page section"><p className="eyebrow">শিক্ষকের আয় ও লেনদেন</p><h1>আয় ও লেনদেন</h1><div className="stats"><Stat label="মোট আয়" value={money(data.total)} accent="green"/><Stat label="অপেক্ষমাণ আয়" value={money(data.pending)}/><Stat label="প্ল্যাটফর্ম কমিশন" value={money(data.commission)} accent="purple"/></div><div className="wallet-box"><div><h2>উত্তোলনের সুবিধা</h2><p>এই হিসাবটি পরীক্ষামূলক; প্রকৃত অর্থ জমা বা উত্তোলন এখনো চালু নেই।</p></div><button className="button" onClick={()=>void payout()}>পরীক্ষামূলক উত্তোলন করুন</button></div>{message&&<p className="success">{message}</p>}<Info title="লেনদেনের ইতিহাস">{data.entries.length?<div className="ledger">{data.entries.slice().reverse().map(e=><p key={e.id}><span>{e.note}<small>{shortDate(e.createdAt)}</small></span><b className={e.amount>=0?'green':'red'}>{e.amount>=0?'+':'−'}{money(Math.abs(e.amount))}</b></p>)}</div>:<Empty>এখনও কোনো লেনদেন নেই।</Empty>}</Info></section>}

type Conversation = { user: User; lastMessage?: { body: string; createdAt: string }; unreadCount: number };
type DirectMessage = { id: string; senderId: string; receiverId: string; body: string; createdAt: string };

const messageRoleLabel = (role: User['role']) => ({ STUDENT: 'শিক্ষার্থী', TEACHER: 'শিক্ষক', PARENT: 'অভিভাবক', ADMIN: 'অ্যাডমিন', SUPER_ADMIN: 'অ্যাডমিন' })[role];
const messageTime = (value?: string) => value ? new Intl.DateTimeFormat('bn-BD', { hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : '';

export function Messages({ user }: { user: User }) {
  const requestedId = new URLSearchParams(location.hash.split('?')[1] || '').get('with');
  const [items, setItems] = useState<Conversation[]>([]);
  const [other, setOther] = useState<User | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [body, setBody] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [mobileThread, setMobileThread] = useState(false);
  const [live, setLive] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedUserRef = useRef<User | null>(other);
  selectedUserRef.current = other;

  useEffect(() => {
    let active = true;
    void api<Conversation[]>('/messages').then(async conversations => {
      if (!active) return;
      setItems(conversations);
      const selected = conversations.find(item => item.user.id === requestedId) || conversations[0];
      if (selected) setOther(selected.user);
      if (requestedId) {
        setMobileThread(true);
        if (!selected) {
          const contact = await api<User>(`/messages/contacts/${encodeURIComponent(requestedId)}`);
          if (active) setOther(contact);
        }
      }
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'কথোপকথন লোড করা যায়নি।');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [requestedId]);

  useEffect(() => {
    if (!other) { setMessages([]); return; }
    let active = true;
    setThreadLoading(true);
    setError('');
    setMessages([]);
    void api<DirectMessage[]>(`/messages/${other.id}`).then(async conversation => {
      if (!active) return;
      setMessages(conversation);
      await post(`/messages/${other.id}/read`);
      if (active) setItems(current => current.map(item => item.user.id === other.id ? { ...item, unreadCount: 0 } : item));
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'বার্তা লোড করা যায়নি।');
    }).finally(() => { if (active) setThreadLoading(false); });

    return () => { active = false; };
  }, [other, user.id]);

  // Keep the inbox subscribed even before either person opens a conversation.
  // This lets a teacher with an empty inbox see the student's first message live.
  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let reconnectDelay = 1000;
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';

    const connect = () => {
      if (!active) return;
      socket = new WebSocket(`${protocol}://${location.host}/ws`);
      socket.onopen = () => {
        if (!active) return;
        reconnectDelay = 1000;
        setLive(true);
        void api<Conversation[]>('/messages').then(conversations => {
          if (active) setItems(conversations);
        }).catch(() => undefined);
        const selected = selectedUserRef.current;
        if (selected) {
          void api<DirectMessage[]>(`/messages/${selected.id}`).then(conversation => {
            if (active && selectedUserRef.current?.id === selected.id) setMessages(conversation);
          }).catch(() => undefined);
        }
      };
      socket.onclose = () => {
        if (!active) return;
        setLive(false);
        reconnectTimer = window.setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 30000);
      };
      socket.onerror = () => {
        if (active) setLive(false);
        socket?.close();
      };
      socket.onmessage = event => {
        try {
          const packet = JSON.parse(event.data) as { type: string; data?: DirectMessage; message?: string };
          if (packet.type === 'message' && packet.data) {
            const message = packet.data;
            const otherId = message.senderId === user.id ? message.receiverId : message.senderId;
            const selected = selectedUserRef.current;
            if (selected?.id === otherId) {
              setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message]);
              if (message.receiverId === user.id) {
                void post(`/messages/${otherId}/read`).then(() => {
                  setItems(current => current.map(item => item.user.id === otherId ? { ...item, unreadCount: 0 } : item));
                });
              }
            }
            // Refresh contact details, latest message, and unread counts; this also
            // inserts a brand-new conversation into an inbox that was previously empty.
            void api<Conversation[]>('/messages').then(conversations => {
              if (active) setItems(conversations);
            }).catch(() => undefined);
          } else if (packet.type === 'error' && packet.message) setError(packet.message);
        } catch { setError('বার্তার আপডেট পাওয়া যায়নি।'); }
      };
    };

    connect();
    return () => {
      active = false;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [user.id]);

  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages, other]);

  const filteredItems = items.filter(item => `${item.user.name} ${item.lastMessage?.body || ''}`.toLocaleLowerCase('bn').includes(query.trim().toLocaleLowerCase('bn')));
  const unreadTotal = items.reduce((total, item) => total + item.unreadCount, 0);

  const selectConversation = (person: User) => {
    setOther(person);
    setMobileThread(true);
    setError('');
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!other || !body.trim() || sending) return;
    const value = body.trim();
    setSending(true);
    setError('');
    try {
      const sent = await post<DirectMessage>(`/messages/${other.id}`, { body: value });
      setMessages(current => current.some(item => item.id === sent.id) ? current : [...current, sent]);
      setItems(current => {
        const existing = current.find(item => item.user.id === other.id);
        const updated = existing ? { ...existing, lastMessage: sent, unreadCount: 0 } : { user: other, lastMessage: sent, unreadCount: 0 };
        return [updated, ...current.filter(item => item.user.id !== other.id)];
      });
      setBody('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'বার্তা পাঠানো যায়নি। আবার চেষ্টা করুন।');
    } finally { setSending(false); }
  };

  return <section className={`messages-page page section${mobileThread ? ' show-thread' : ''}`}>
    <header className="messages-intro learning-art-header">
      <div><p className="eyebrow">যোগাযোগ</p><h1>বার্তা</h1><p>শিক্ষক ও শিক্ষার্থীর সঙ্গে শেখার প্রয়োজনীয় কথা বলুন—সব কথোপকথন এক জায়গায়।</p></div>
      <div className="messages-summary"><span className="messages-summary-icon" aria-hidden="true">✉</span><span><b>{bn(items.length)}</b><small>টি কথোপকথন</small></span>{unreadTotal > 0 && <span className="unread-total">{bn(unreadTotal)} অপঠিত</span>}</div>
    </header>
    <div className="messages-shell">
      <aside className="messages-sidebar" aria-label="কথোপকথনের তালিকা">
        <div className="inbox-heading"><div><h2>ইনবক্স</h2><p>আপনার সব বার্তা</p></div><span className="inbox-count">{bn(items.length)}</span></div>
        <label className="conversation-search"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="নাম বা বার্তা খুঁজুন" aria-label="কথোপকথন খুঁজুন"/><kbd>/</kbd></label>
        <div className="conversation-list">
          {loading ? <Loading/> : error && !other ? <div className="messages-inline-error" role="alert">{error}</div> : filteredItems.length ? filteredItems.map(item => <button type="button" className={`conversation-card${other?.id === item.user.id ? ' active' : ''}`} key={item.user.id} onClick={() => selectConversation(item.user)} aria-current={other?.id === item.user.id ? 'true' : undefined}>
            <span className="conversation-avatar"><Avatar name={item.user.name} size="sm" photoUrl={photoFromUser(item.user)}/>{item.unreadCount > 0 && <i aria-label={`${bn(item.unreadCount)}টি অপঠিত বার্তা`}/>}</span>
            <span className="conversation-details"><span className="conversation-name-row"><b>{item.user.name}</b><time>{messageTime(item.lastMessage?.createdAt)}</time></span><small className="conversation-role">{messageRoleLabel(item.user.role)}</small><span className="conversation-preview">{item.lastMessage?.body || 'কথোপকথন শুরু করুন'}</span></span>
            {item.unreadCount > 0 && <span className="unread-count">{bn(item.unreadCount)}</span>}
          </button>) : <div className="inbox-empty"><span aria-hidden="true">✉</span><b>{items.length ? 'কোনো মিল পাওয়া যায়নি' : 'ইনবক্স এখনো ফাঁকা'}</b><p>{items.length ? 'অন্য নাম বা শব্দ দিয়ে খুঁজে দেখুন।' : user.role === 'STUDENT' ? 'শিক্ষকের প্রোফাইল থেকে যোগাযোগ শুরু করলে কথোপকথন এখানে দেখা যাবে।' : 'শিক্ষার্থীর সঙ্গে কথোপকথন শুরু হলে এখানে দেখা যাবে।'}</p>{!items.length && <a className="quiet-btn" href={user.role === 'STUDENT' ? '#/search' : '#/bookings'}>{user.role === 'STUDENT' ? 'শিক্ষক খুঁজুন' : 'বুকিং দেখুন'} <span aria-hidden="true">→</span></a>}</div>}
        </div>
        <div className="inbox-footnote"><span aria-hidden="true">🔒</span> আপনার কথোপকথন ব্যক্তিগত</div>
      </aside>

      <div className="message-thread">
        {other ? <>
          <header className="thread-header">
            <button type="button" className="thread-back" onClick={() => setMobileThread(false)} aria-label="ইনবক্সে ফিরুন">←</button>
            <Avatar name={other.name} size="sm" photoUrl={photoFromUser(other)}/>
            <span className="thread-person"><b>{other.name}</b><small>{messageRoleLabel(other.role)} · শিখোক</small></span>
            <span className={`connection-state${live ? ' is-live' : ' is-reconnecting'}`} role="status"><i/>{live ? 'লাইভ' : 'সংযোগ হচ্ছে'}</span>
          </header>
          <div className="thread-messages" ref={listRef} aria-live="polite">
            {threadLoading ? <Loading/> : messages.length ? <>
              <div className="thread-date-label"><span>কথোপকথন</span></div>
              {messages.map(message => <article className={`message-bubble${message.senderId === user.id ? ' mine' : ''}`} key={message.id}>
                <p>{message.body}</p><time>{messageTime(message.createdAt)}</time>
              </article>)}
            </> : !error && <div className="thread-empty"><span aria-hidden="true">☀</span><b>কথা শুরু হোক</b><p>ক্লাস, সময় বা শেখার লক্ষ্য নিয়ে আপনার প্রথম বার্তাটি পাঠান।</p></div>}
          </div>
          {error && other && <p className="thread-error" role="alert">{error}</p>}
          <form className="message-composer" onSubmit={send}>
            <label className="composer-field"><textarea value={body} onChange={event => setBody(event.target.value)} placeholder="আপনার বার্তা লিখুন…" aria-label="আপনার বার্তা লিখুন" rows={1} maxLength={1000} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}/><small>Enter পাঠাবে · Shift + Enter নতুন লাইন</small></label>
            <button className="button send-button" disabled={!body.trim() || sending} aria-label="বার্তা পাঠান">{sending ? 'পাঠানো হচ্ছে…' : <>পাঠান <span aria-hidden="true">↑</span></>}</button>
          </form>
        </> : <div className="thread-placeholder"><span className="placeholder-mark" aria-hidden="true">✉</span><p className="eyebrow">শিখোক বার্তা</p><h2>{items.length ? 'কথোপকথন বেছে নিন' : 'শেখার কথা শুরু করুন'}</h2><p>{items.length ? 'ইনবক্স থেকে একজনকে বেছে নিয়ে বার্তা পড়ুন ও উত্তর দিন।' : 'শিক্ষক বা শিক্ষার্থীর সঙ্গে প্রয়োজনীয় আলোচনা এখানে গুছিয়ে রাখুন।'}</p>{!items.length && <a className="button" href={user.role === 'STUDENT' ? '#/search' : '#/bookings'}>{user.role === 'STUDENT' ? 'শিক্ষক খুঁজুন' : 'বুকিং দেখুন'} <span aria-hidden="true">→</span></a>}</div>}
      </div>
    </div>
  </section>;
}

export function Exams({ user }: { user: User }) {
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [active, setActive] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const [result, setResult] = useState<ExamAttemptResult | null>(null);
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('সব বিষয়');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [progressSeconds, setProgressSeconds] = useState(0);

  const load = async () => {
    setError('');
    try { setExams(await api<Exam[]>('/exams')); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'পরীক্ষার তালিকা আনা যায়নি।'); }
  };
  useEffect(() => { void load(); }, []);

  const open = async (examId: string) => {
    setError('');
    setAnswers({});
    setResult(null);
    try {
      const exam = await api<Exam>(`/exams/${examId}`);
      setActive(exam);
      setProgressSeconds(exam.duration * 60);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'পরীক্ষাটি খোলা যায়নি।'); }
  };
  const submit = async () => {
    if (!active || submitting || result) return;
    setSubmitting(true);
    setError('');
    try {
      setResult(await post<ExamAttemptResult>(`/exams/${active.id}/submit`, { answers: answersRef.current }));
      setConfirmSubmit(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'উত্তর জমা দেওয়া যায়নি।'); }
    finally { setSubmitting(false); }
  };
  useEffect(() => {
    if (!active || result || progressSeconds <= 0) return;
    const timer = window.setInterval(() => setProgressSeconds(seconds => {
      if (seconds <= 1) { window.clearInterval(timer); void submit(); return 0; }
      return seconds - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [active, result]);

  if (user.role !== 'STUDENT') return <section className="page section"><Empty>পরীক্ষায় অংশ নিতে শিক্ষার্থী হিসেবে লগইন করুন।</Empty></section>;

  if (active) {
    const questions = Array.isArray(active.questions) ? active.questions : [];
    const answered = questions.filter(question => answers[question.id] !== undefined).length;
    const minutes = Math.floor(progressSeconds / 60);
    const seconds = progressSeconds % 60;
    const scorePercent = result?.percentage || 0;
    return <section className="page section exam-session">
      <header className="exam-session-heading learning-art-header">
        <button className="exam-back-link" type="button" onClick={() => { setActive(null); setResult(null); }}>← <span>সব পরীক্ষা</span></button>
        <div className="exam-session-title"><p className="eyebrow">{active.subject} · {active.topic}</p><h1>{active.title}</h1><p>{active.instructions || active.description || 'প্রতিটি প্রশ্নে একটি সঠিক উত্তর বেছে নিন।'}</p></div>
        <div className={`exam-timer${progressSeconds < 60 ? ' is-urgent' : ''}`} aria-label="অবশিষ্ট সময়"><span aria-hidden="true">◷</span><b>{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</b><small>অবশিষ্ট সময়</small></div>
      </header>
      <div className="exam-progress-card"><div><span>উত্তর দেওয়া হয়েছে</span><b>{bn(answered)} <small>/ {bn(questions.length)}</small></b></div><div className="exam-progress-track"><i style={{ width: `${questions.length ? answered / questions.length * 100 : 0}%` }} /></div><div className="exam-question-jump" aria-label="প্রশ্নে যান">{questions.map((question, index) => <button className={answers[question.id] === undefined ? '' : 'is-answered'} type="button" key={question.id} aria-label={`প্রশ্ন ${bn(index + 1)}${answers[question.id] === undefined ? ', উত্তর দেওয়া হয়নি' : ', উত্তর দেওয়া হয়েছে'}`} onClick={() => document.getElementById(`exam-session-question-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>{bn(index + 1)}</button>)}</div></div>
      {error && <p className="exam-feedback" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="বার্তা বন্ধ করুন">×</button></p>}
      {result ? <div className="exam-result-wrap">
        <section className={`exam-result-card${result.passed ? ' is-passed' : ' is-failed'}`}>
          <span className="exam-result-icon" aria-hidden="true">{result.passed ? '✓' : '↗'}</span><p className="eyebrow">পরীক্ষা সম্পন্ন</p><h2>{result.passed ? 'চমৎকার কাজ!' : 'আরও একটু অনুশীলন করুন'}</h2>
          <strong className="exam-result-score">{bn(result.score)} <small>/ {bn(result.total)}</small></strong><div className="exam-result-percent">{bn(scorePercent)}%</div>
          <div className="exam-result-stats"><span><b>{bn(result.correctCount)}</b>সঠিক</span><span><b>{bn(result.incorrectCount)}</b>ভুল</span><span><b>{bn(result.unansweredCount)}</b>উত্তরহীন</span></div>
          <p className={`exam-pass-state${result.passed ? ' is-passed' : ' is-failed'}`}>{result.passed ? 'পাস নম্বর অর্জিত হয়েছে' : `পাস করতে প্রয়োজন ${bn(active.passMark)}%`}</p>
          <button className="button" type="button" onClick={() => { setActive(null); setResult(null); setAnswers({}); }}>অন্য পরীক্ষা বেছে নিন</button>
        </section>
        {result.showAnswers ? <ExamAnswerReview review={result.review || []} /> : <p className="exam-review-hidden">এই পরীক্ষার উত্তরমালা শিক্ষক প্রকাশ করেননি।</p>}
      </div> : <>
        <div className="exam-instruction-note"><span aria-hidden="true">✦</span><p>সব প্রশ্নের উত্তর বাধ্যতামূলক নয়। জমা দেওয়ার পর আপনার স্কোর, সঠিক উত্তর ও ব্যাখ্যা দেখতে পারবেন।</p></div>
        <div className="exam-session-questions">{questions.map((question, index) => <fieldset className="exam-session-question" id={`exam-session-question-${index}`} key={question.id}>
          <legend><span>প্রশ্ন {bn(index + 1)}</span><small>{bn(question.marks)} নম্বর</small></legend><h2>{question.text}</h2>
          <div className="exam-session-options">{question.options.map((option, optionIndex) => <label className={answers[question.id] === optionIndex ? 'is-selected' : ''} key={`${question.id}-${optionIndex}`}><input type="radio" name={question.id} checked={answers[question.id] === optionIndex} onChange={() => setAnswers(current => ({ ...current, [question.id]: optionIndex }))} /><span className="exam-option-letter">{String.fromCharCode(65 + optionIndex)}</span><span>{option}</span><i aria-hidden="true">✓</i></label>)}</div>
        </fieldset>)}</div>
        <footer className="exam-submit-bar"><span><b>{bn(answered)}/{bn(questions.length)}</b>টি প্রশ্নের উত্তর দেওয়া হয়েছে</span><button className="button" type="button" disabled={submitting} onClick={() => setConfirmSubmit(true)}>{submitting ? 'জমা হচ্ছে…' : 'পরীক্ষা জমা দিন'} <span aria-hidden="true">→</span></button></footer>
      </>}
      {confirmSubmit && !result && <div className="exam-confirm-backdrop"><section className="exam-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="exam-confirm-title"><span aria-hidden="true">✓</span><h2 id="exam-confirm-title">উত্তর জমা দেবেন?</h2><p>{answered === questions.length ? 'সব প্রশ্নের উত্তর দেওয়া হয়েছে।' : `${bn(questions.length - answered)}টি প্রশ্নের উত্তর দেওয়া হয়নি। জমা দিলে আর পরিবর্তন করা যাবে না।`}</p><div><button className="quiet-btn" type="button" onClick={() => setConfirmSubmit(false)}>আরও দেখুন</button><button className="button" type="button" disabled={submitting} onClick={() => void submit()}>{submitting ? 'জমা হচ্ছে…' : 'জমা নিশ্চিত করুন'}</button></div></section></div>}
    </section>;
  }

  if (user.role !== 'STUDENT') return null;
  const subjects = ['সব বিষয়', ...new Set((exams || []).map(exam => exam.subject))];
  const filtered = (exams || []).filter(exam => (subject === 'সব বিষয়' || exam.subject === subject) && `${exam.title} ${exam.subject} ${exam.topic}`.toLocaleLowerCase('bn').includes(query.trim().toLocaleLowerCase('bn')));
  return <section className="exams-page">
    <header className="exams-hero learning-art-header"><div className="exams-hero-copy"><p className="eyebrow">শিখুন · অনুশীলন করুন · এগিয়ে যান</p><h1>প্রস্তুতি যাচাইয়ের সেরা সময় এখনই</h1><p>বিষয়ভিত্তিক MCQ পরীক্ষায় নিজের প্রস্তুতি যাচাই করুন। জমা দেওয়ার পর প্রতিটি উত্তরের সঠিক সমাধান ও ব্যাখ্যা দেখে শিখুন।</p><div className="exams-hero-points"><span>✓ সময় ধরে অনুশীলন</span><span>✓ তাৎক্ষণিক স্কোর</span><span>✓ উত্তর ও ব্যাখ্যা</span></div></div><div className="exams-hero-art" aria-hidden="true"><span>✓</span><b>MCQ</b><small>জ্ঞান যাচাই</small><i>✦</i></div></header>
    <section className="exams-catalog page section" aria-labelledby="exams-catalog-title"><div className="exams-catalog-heading"><div><p className="eyebrow">আপনার অনুশীলন</p><h2 id="exams-catalog-title">বিষয়ভিত্তিক পরীক্ষা</h2><p>একটি পরীক্ষা বেছে নিয়ে প্রস্তুতি শুরু করুন।</p></div>{exams&&<span className="exams-total"><b>{bn(exams.length)}</b>টি পরীক্ষা</span>}</div>
      <div className="exams-filter-row"><label className="exam-search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="পরীক্ষা বা বিষয় খুঁজুন" aria-label="পরীক্ষা বা বিষয় খুঁজুন"/><kbd>⌕</kbd></label><div className="exam-subject-filters" aria-label="বিষয় অনুযায়ী ফিল্টার">{subjects.map(item => <button className={subject === item ? 'is-active' : ''} key={item} type="button" onClick={() => setSubject(item)}>{item}</button>)}</div></div>
      {error && !active && <p className="exam-feedback" role="alert">{error}<button type="button" onClick={() => void load()}>আবার চেষ্টা করুন</button></p>}
      {!exams ? <Loading/> : filtered.length ? <div className="exam-catalog-grid">{filtered.map((exam, index) => {
        const questionCount = typeof exam.questions === 'number' ? exam.questions : exam.questionCount || exam.questionIds?.length || 0;
        return <article className="exam-catalog-card" key={exam.id}>
          <div className={`exam-card-icon exam-card-icon-${index % 5}`} aria-hidden="true">{({ 'গণিত':'∑', 'পদার্থবিজ্ঞান':'⚛', 'রসায়ন':'⚗', 'জীববিজ্ঞান':'✳', 'ইংরেজি':'Aa', 'বাংলা':'অ', 'আইসিটি':'⌘', 'হিসাববিজ্ঞান':'▤', 'ফিন্যান্স':'৳', 'প্রোগ্রামিং':'</>' } as Record<string,string>)[exam.subject] || '✦'}</div>
          <div className="exam-card-subject"><span>{exam.subject}</span><span className="exam-card-published"><i/>প্রকাশিত</span></div><h3>{exam.title}</h3><p>{exam.description || `${exam.subject} বিষয়ে গুরুত্বপূর্ণ ধারণা ও প্রশ্ন অনুশীলন করুন।`}</p>
          <div className="exam-card-meta"><span><i aria-hidden="true">▤</i>{bn(questionCount)}টি MCQ</span><span><i aria-hidden="true">◷</i>{bn(exam.duration)} মিনিট</span><span><i aria-hidden="true">✓</i>পাস {bn(exam.passMark)}%</span></div>
          <button className="exam-card-start" type="button" onClick={() => void open(exam.id)}>অনুশীলন শুরু করুন <span aria-hidden="true">→</span></button>
        </article>;
      })}</div> : <div className="exam-empty-state"><span aria-hidden="true">⌕</span><h3>কোনো পরীক্ষা মেলেনি</h3><p>বিষয় বদলে দেখুন অথবা অন্য শব্দ দিয়ে খুঁজুন।</p><button className="quiet-btn" type="button" onClick={() => { setQuery(''); setSubject('সব বিষয়'); }}>ফিল্টার মুছুন</button></div>}
    </section>
  </section>;
}

export function Problems({user}:{user:User|null}) {
  const [items,setItems]=useState<ProblemPost[]>([]);
  const [teachers,setTeachers]=useState<Teacher[]>([]);
  const [open,setOpen]=useState(false);
  const [offer,setOffer]=useState<string|null>(null);
  const [bookingTeacher,setBookingTeacher]=useState<Teacher|null>(null);
  const [query,setQuery]=useState('');
  const [subject,setSubject]=useState('সব বিষয়');
  const [sort,setSort]=useState('newest');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  const load=async()=>{setLoading(true);try{setItems(await api<ProblemPost[]>('/problems'));setError('');}catch{setError('সমস্যাগুলো লোড করা যাচ্ছে না। আবার চেষ্টা করুন।');}finally{setLoading(false);}};
  useEffect(()=>{void load();},[]);
  useEffect(()=>{void api<Teacher[]>('/problem-sessions').then(setTeachers).catch(()=>setTeachers([]));},[]);

  const subjects=Array.from(new Set(items.map(item=>item.subject)));
  const filtered=items.filter(item=>{
    const text=(item.title+' '+item.description+' '+item.subject+' '+item.topic+' '+(item.student?.name||'')).toLocaleLowerCase('bn');
    return (subject==='সব বিষয়'||item.subject===subject)&&(!query.trim()||text.includes(query.trim().toLocaleLowerCase('bn')));
  }).sort((a,b)=>sort==='budget' ? b.budget-a.budget : b.createdAt.localeCompare(a.createdAt));
  const onlineTeachers=teachers.filter(teacher=>teacher.isLive).length;

  return <section className="page section problem-market-page">
    <div className="problem-market-hero learning-art-header">
      <div className="problem-hero-copy">
        <p className="eyebrow">শিখুন, বুঝুন, এগিয়ে যান</p>
        <h1>যে প্রশ্নে আটকে আছেন,<br/><span>সেটার সমাধান এখানেই</span></h1>
        <p>আপনার শেখার সমস্যাটি শেয়ার করুন। বিষয়ভিত্তিক শিক্ষকরা প্রস্তাব দেবেন, আপনি পছন্দের সহায়তাটি বেছে নেবেন।</p>
        {user?.role==='STUDENT'?<button className="button problem-hero-action" onClick={()=>setOpen(true)}>＋ সমস্যা পোস্ট করুন</button>:<button className="quiet-btn problem-hero-action" onClick={()=>go('/login')}>শিক্ষার্থী হিসেবে লগইন করুন</button>}
        <div className="problem-hero-note"><span aria-hidden="true">✓</span> সমস্যার বিবরণ ও বাজেট আপনি নিজেই ঠিক করবেন</div>
      </div>
      <div className="problem-hero-visual" aria-hidden="true">
        <span className="problem-visual-ring ring-a"/><span className="problem-visual-ring ring-b"/>
        <div className="problem-visual-card"><span className="problem-visual-symbol">?</span><small>প্রশ্ন থেকে</small><b>সমাধান</b><i>শিক্ষকের সহায়তায়</i></div>
        <span className="problem-visual-spark spark-a">✦</span><span className="problem-visual-spark spark-b">✳</span>
      </div>
    </div>

    <div className="problem-market-stats">
      <article><span className="problem-stat-icon">▤</span><div><b>{bn(items.length)}</b><small>মোট সমস্যা</small></div></article>
      <article><span className="problem-stat-icon open-icon">↗</span><div><b>{bn(items.filter(item=>item.status==='OPEN').length)}</b><small>সহায়তার জন্য খোলা</small></div></article>
      <article><span className="problem-stat-icon live-icon">●</span><div><b>{bn(onlineTeachers)}</b><small>শিক্ষক এখন লাইভ</small></div></article>
    </div>

    <div className="problem-content-head">
      <div><p className="eyebrow">শিক্ষার্থীদের প্রশ্ন</p><h2>একটি সমস্যা বেছে নিন</h2></div>
      <span className="problem-result-count">{loading?'লোড হচ্ছে…':bn(filtered.length)+'টি সমস্যা'}</span>
    </div>

    <div className="problem-tools">
      <label className="problem-search"><span aria-hidden="true">⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="সমস্যা, বিষয় বা টপিক খুঁজুন" aria-label="সমস্যা, বিষয় বা টপিক খুঁজুন"/></label>
      <label className="problem-sort"><span>সাজান</span><select value={sort} onChange={event=>setSort(event.target.value)}><option value="newest">নতুন আগে</option><option value="budget">বাজেট বেশি আগে</option></select></label>
    </div>

    <div className="problem-market-layout">
      <div className="problem-list-column">
        <div className="problem-subject-filter" aria-label="বিষয় দিয়ে সমস্যা বাছাই">
          {['সব বিষয়',...subjects].map(value=><button key={value} className={subject===value?'active':''} onClick={()=>setSubject(value)}>{value}</button>)}
        </div>
        {loading?<div className="problem-loading"><span/><p>শিক্ষার্থীদের সমস্যা খোঁজা হচ্ছে…</p></div>:error?<div className="problem-empty"><span>!</span><h3>তথ্য পাওয়া যায়নি</h3><p>{error}</p><button className="quiet-btn" onClick={()=>void load()}>আবার চেষ্টা করুন</button></div>:filtered.length?<div className="problem-market-grid">
          {filtered.map((p,index)=><article className="problem-market-card" key={p.id}>
            <div className="problem-card-top"><span className="problem-subject-mark">{p.subject==='গণিত'?'∑':p.subject==='পদার্থবিজ্ঞান'?'⚛':p.subject==='রসায়ন'?'⚗':p.subject==='ইংরেজি'?'Aa':'✦'}</span><span className={'problem-status '+p.status}>{p.status==='OPEN'?'সহায়তা চাই':p.status==='CLOSED'?'সমাপ্ত':'চলমান'}</span><span className="problem-card-number">{String(index+1).padStart(2,'0')}</span></div>
            <div className="problem-card-content">
              <div className="problem-topic-line"><span>{p.subject}</span><i>·</i><span>{p.topic}</span></div>
              <h3>{p.title}</h3>
              <p className="problem-card-description">{p.description}</p>
              <div className="problem-posted-by"><span className="problem-student-avatar">{(p.student?.name||'শ').trim().slice(0,1)}</span><span><small>পোস্ট করেছেন</small><b>{p.student?.name||'একজন শিক্ষার্থী'}</b></span><span className="problem-posted-date">{new Intl.DateTimeFormat('bn-BD',{dateStyle:'medium'}).format(new Date(p.createdAt))}</span></div>
              <div className="problem-card-footer"><div className="problem-budget"><small>প্রস্তাবিত বাজেট</small><b>{money(p.budget)}</b></div><div className="problem-deadline"><small>প্রয়োজনের সময়</small><b>{new Intl.DateTimeFormat('bn-BD',{dateStyle:'medium'}).format(new Date(p.deadline))}</b></div></div>
              {user?.role==='TEACHER'&&p.status==='OPEN'&&<button className="button problem-propose-button" onClick={()=>setOffer(p.id)}>এই সমস্যায় প্রস্তাব দিন <span aria-hidden="true">↗</span></button>}
              {user?.id===p.studentId&&p.offers?.length?<OfferList problem={p} onDone={()=>void load()}/>:null}
            </div>
          </article>)}
        </div>:<div className="problem-empty"><span>⌕</span><h3>এই খোঁজে কোনো সমস্যা নেই</h3><p>অন্য বিষয় বেছে নিন অথবা সার্চের শব্দ বদলে দেখুন।</p><button className="quiet-btn" onClick={()=>{setQuery('');setSubject('সব বিষয়');}}>সব সমস্যা দেখুন</button></div>}
      </div>

      <aside className="problem-live-panel">
        <div className="problem-live-heading"><span className="problem-live-dot"/><div><p className="eyebrow">সরাসরি সহায়তা</p><h2>লাইভ শিক্ষক</h2></div><span className="problem-live-count">{bn(onlineTeachers)} লাইভ</span></div>
        <p className="problem-live-intro">এখনই কথা বলুন বা সুবিধামতো একটি সময় বেছে নিন।</p>
        {teachers.length?teachers.slice(0,4).map(t=><article className="problem-live-teacher" key={t.id}>
          <div className="problem-live-person"><Avatar name={t.user.name} size="sm" teacherId={t.id} photoUrl={photoFromUser(t.user)}/><div><b>{t.user.name}</b><small>{t.subjects[0]} · {bn(t.experienceYears)} বছরের অভিজ্ঞতা</small></div><span className={'live-pill '+(t.isLive?'online':'offline')}>{t.isLive?'লাইভ':'অফলাইন'}</span></div>
          <p>{t.headline}</p><div className="problem-live-rating"><span>★ {t.rating.toFixed(1)} <small>({bn(t.reviewCount)} রিভিউ)</small></span><b>{money(t.sessionPrice??t.hourlyRate)}</b></div>
          <div className="problem-live-actions"><button className="quiet-btn" onClick={()=>go(user?.role==='STUDENT'?`/messages?with=${encodeURIComponent(t.user.id)}`:'/messages')}>চ্যাট</button><button className="button" onClick={()=>setBookingTeacher(t)}>সময় বেছে নিন</button></div>
        </article>):<div className="problem-live-empty">এই মুহূর্তে লাইভ শিক্ষক নেই। পরে আবার দেখুন।</div>}
        <a className="problem-all-teachers" href="#/search">সব শিক্ষক দেখুন <span>→</span></a>
      </aside>
    </div>
    {open&&<ProblemForm onClose={()=>setOpen(false)} onDone={()=>{setOpen(false);void load();}}/>}
    {offer&&<OfferForm problemId={offer} onClose={()=>setOffer(null)} onDone={()=>{setOffer(null);void load();}}/>}
    {bookingTeacher&&<ProblemSessionModal teacher={bookingTeacher} onClose={()=>setBookingTeacher(null)} onDone={id=>{setBookingTeacher(null);go('/payment/'+id);}}/>}
  </section>;
}
function ProblemSessionModal({teacher,onClose,onDone}:{teacher:Teacher;onClose:()=>void;onDone:(id:string)=>void}){const dayNames=Object.keys(teacher.availability || {});const [day,setDay]=useState(dayNames[0] || '');const [date,setDate]=useState(()=>nextDateForDay(dayNames[0] || 'শনিবার'));const [time,setTime]=useState((teacher.availability?.[dayNames[0]] || [])[0] || '');const [busy,setBusy]=useState(false);const [error,setError]=useState('');useEffect(()=>{if(!dayNames.length)return;setDate(nextDateForDay(day));setTime((teacher.availability?.[day] || [])[0] || '');},[day,dayNames,teacher]);const fee = teacher.sessionPrice ?? teacher.hourlyRate;const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{const b=await post<{id:string}>('/problem-sessions',{teacherId:teacher.id,date,time,price:fee,subject:(teacher.subjects[0]||'গণিত')});onDone(b.id);}catch(e){setError(e instanceof Error?e.message:'সমস্যা হয়েছে');}finally{setBusy(false);}};return <div className="modal-back"><section className="modal" role="dialog" aria-modal="true" aria-label="সেশন বুক করুন"><button className="close" onClick={onClose}>×</button><p className="eyebrow">লাইভ এক-এক সেশন</p><h2>{teacher.user.name}</h2><p>{teacher.headline}</p><div className="price-line"><span>সেশন ফি</span><b>{money(fee)}</b></div><form onSubmit={submit}><label>দিন<select value={day} onChange={e=>setDay(e.target.value)}>{dayNames.map(d=><option value={d} key={d}>{d}</option>)}</select></label><label>তারিখ<input type="date" value={date} min={new Date().toISOString().slice(0,10)} onChange={e=>setDate(e.target.value)} required/></label><label>সময়<select value={time} onChange={e=>setTime(e.target.value)}>{(teacher.availability?.[day] || []).map(slot=><option key={slot} value={slot}>{slot}</option>)}</select></label>{error&&<p className="form-error">{error}</p>}<button className="button wide" disabled={busy}>{busy?'বুকিং তৈরি হচ্ছে…':'পেমেন্টে এগিয়ে যান'}</button></form></section></div>}
function nextDateForDay(day:string){const labels=['শনিবার','রোববার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার'];const idx=labels.indexOf(day);const now=new Date();const target=new Date(now);const delta=(idx - now.getDay() + 7) % 7 || 7;target.setDate(now.getDate()+delta);return target.toISOString().slice(0,10)}
function ProblemForm({onClose,onDone}:{onClose:()=>void;onDone:()=>void}){const [f,setF]=useState({title:'',description:'',subject:'গণিত',topic:'ক্যালকুলাস',budget:'400',deadline:new Date(Date.now()+172800000).toISOString().slice(0,10)});const [error,setError]=useState('');const submit=async(e:React.FormEvent)=>{e.preventDefault();try{await post('/problems',{...f,budget:Number(f.budget)});onDone();}catch(e){setError(e instanceof Error?e.message:'সমস্যা হয়েছে');}};return <div className="modal-back"><section className="modal"><button className="close" onClick={onClose}>×</button><h2>নতুন সমস্যা পোস্ট করুন</h2><form onSubmit={submit}><label>সমস্যার শিরোনাম<input value={f.title} onChange={e=>setF({...f,title:e.target.value})} required/></label><label>বিস্তারিত<textarea value={f.description} onChange={e=>setF({...f,description:e.target.value})} required/></label><div className="two"><label>বিষয়<input value={f.subject} onChange={e=>setF({...f,subject:e.target.value})}/></label><label>টপিক<input value={f.topic} onChange={e=>setF({...f,topic:e.target.value})}/></label></div><div className="two"><label>বাজেট<input type="number" value={f.budget} onChange={e=>setF({...f,budget:e.target.value})}/></label><label>সময়সীমা<input type="date" value={f.deadline} onChange={e=>setF({...f,deadline:e.target.value})}/></label></div>{error&&<p className="form-error">{error}</p>}<button className="button wide">পোস্ট প্রকাশ করুন</button></form></section></div>}
function OfferForm({problemId,onClose,onDone}:{problemId:string;onClose:()=>void;onDone:()=>void}){const [f,setF]=useState({message:'আমি ধাপে ধাপে সমাধান বুঝিয়ে দেব।',price:'400'});const submit=async(e:React.FormEvent)=>{e.preventDefault();await post(`/problems/${problemId}/offers`,{...f,price:Number(f.price)});onDone();};return <div className="modal-back"><section className="modal"><button className="close" onClick={onClose}>×</button><h2>সমাধানের প্রস্তাব দিন</h2><form onSubmit={submit}><label>আপনার বার্তা<textarea value={f.message} onChange={e=>setF({...f,message:e.target.value})}/></label><label>প্রস্তাবিত ফি<input type="number" value={f.price} onChange={e=>setF({...f,price:e.target.value})}/></label><button className="button wide">প্রস্তাব পাঠান</button></form></section></div>}
function OfferList({problem,onDone}:{problem:any;onDone:()=>void}){const accept=async(id:string)=>{await post(`/problems/${problem.id}/offers/${id}/accept`);onDone();};return <div className="offers"><b>{bn(problem.offers.length)}টি প্রস্তাব</b>{problem.offers.map((o:any)=><p key={o.id}>{o.message} <span>{money(o.price)}</span>{o.status==='PENDING'&&<button className="quiet-btn" onClick={()=>void accept(o.id)}>গ্রহণ করুন</button>}</p>)}</div>}

export function NotificationsPage(){const [items,setItems]=useState<Notification[]|null>(null);const mark=async(n:Notification)=>{await post(`/notifications/${n.id}/read`);setItems(items?.map(x=>x.id===n.id?{...x,readAt:new Date().toISOString()}:x)||null);go(n.href);};useEffect(()=>{void api<Notification[]>('/notifications').then(setItems);},[]);return <section className="page section"><p className="eyebrow">আপডেট</p><h1>নোটিফিকেশন</h1>{items?<div className="notification-page">{items.length?items.map(n=><button className={n.readAt?'read':''} onClick={()=>void mark(n)} key={n.id}><span>{n.type==='BOOKING'?'▣':'●'}</span><div><b>{n.title}</b><p>{n.body}</p><small>{shortDate(n.createdAt)}</small></div></button>):<Empty>নতুন কোনো নোটিফিকেশন নেই।</Empty>}</div>:<Loading/>}</section>}
