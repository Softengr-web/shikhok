import { useEffect, useRef, useState } from 'react';
import { api, post, put } from './api';
import { Avatar, BookingModal, Empty, Loading, TeacherCard, bn, go, money, shortDate } from './components';
import { TeacherGigEditor, TeacherProfileEditor } from './teacher-dashboard-forms';
import { TeacherDashboardLive } from './teacher-dashboard';
import type { Booking, Exam, Gig, Notification, ProblemPost, Subject, Teacher, User } from './models';

export function Home({user}:{user:User|null}) { const [subjects,setSubjects]=useState<Subject[]>([]);const [teachers,setTeachers]=useState<Teacher[]>([]);const [q,setQ]=useState('');const [compare,setCompare]=useState<Teacher[]>([]);useEffect(()=>{void Promise.all([api<Subject[]>('/subjects'),api<{items:Teacher[]}>('/teachers?perPage=4')]).then(([s,t])=>{setSubjects(s);setTeachers(t.items);});},[]);const toggle=(t:Teacher)=>setCompare(c=>c.some(x=>x.id===t.id)?c.filter(x=>x.id!==t.id):c.length<3?[...c,t]:c);return <><section className="hero"><div><p className="hero-brand" aria-label="Private Tutor">Private <span>Tutor</span><i aria-hidden="true"></i></p><p className="eyebrow">বাংলাদেশের শিক্ষক মার্কেটপ্লেস</p><h1>আপনার জন্য সঠিক শিক্ষক খুঁজে নিন</h1><p>দক্ষ শিক্ষক বাছাই করুন, ডেমো দেখুন, বুক করুন এবং নিজের অগ্রগতি দেখুন।</p><form className="searchbar" onSubmit={e=>{e.preventDefault();go(`/search?q=${encodeURIComponent(q)}`)}}><input value={q} onChange={e=>setQ(e.target.value)} placeholder="আপনি কী শিখতে চান?" aria-label="আপনি কী শিখতে চান?"/><button className="button">শিক্ষক খুঁজুন</button></form><div className="hero-points"><span>✓ যাচাইকৃত শিক্ষক</span><span>✓ স্বচ্ছ ডেমো মূল্য</span><span>✓ লোকাল ক্লাসরুম</span></div></div><div className="hero-panel"><span className="spark">✦</span><p>আজই শুরু করুন</p><b>{bn(20)}+ শিক্ষক</b><small>সকল প্রোফাইল ও লেনদেন সিনথেটিক লোকাল ডেমো ডেটা</small><a href="#/register" className="button light">বিনামূল্যে শুরু করুন</a></div></section><section className="section"><div className="section-head"><div><p className="eyebrow">বিষয় বেছে নিন</p><h2>জনপ্রিয় বিষয়</h2></div><a href="#/search">সব দেখুন →</a></div><div className="categories">{subjects.slice(0,10).map(s=><button key={s.id} onClick={()=>go(`/search?subject=${encodeURIComponent(s.name)}`)}><i>{s.icon}</i><span>{s.name}</span><small>{s.topics.length}টি টপিক</small></button>)}</div></section><section className="section soft"><div className="section-head"><div><p className="eyebrow">শিক্ষক নির্বাচন</p><h2>জনপ্রিয় শিক্ষক</h2></div><a href="#/search">সব শিক্ষক দেখুন →</a></div><div className="card-grid">{teachers.map(t=><TeacherCard key={t.id} teacher={t} user={user} compare={compare.some(x=>x.id===t.id)} onCompare={toggle}/>)}</div>{compare.length>1&&<CompareBar teachers={compare} onRemove={toggle}/>}</section><section className="how"><p className="eyebrow">সহজ তিন ধাপ</p><h2>কীভাবে শিক্ষক কাজ করে</h2><div><article><b>১</b><h3>শিক্ষক খুঁজুন</h3><p>বিষয়, স্তর ও বাজেট দিয়ে পছন্দের শিক্ষক বাছুন।</p></article><article><b>২</b><h3>ক্লাস বুক করুন</h3><p>প্যাকেজ এবং সুবিধাজনক সময় নির্বাচন করে ডেমো পেমেন্ট করুন।</p></article><article><b>৩</b><h3>শিখুন ও এগিয়ে যান</h3><p>লোকাল ক্লাসরুম, নোট, পরীক্ষা ও অগ্রগতি এক জায়গায়।</p></article></div></section></> }
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
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void api<Gig[]>('/gigs')
      .then(items => { if (active) setGigs(items); })
      .catch(() => { if (active) { setGigs([]); setError('গিগগুলো এখন লোড করা যাচ্ছে না। আবার চেষ্টা করুন।'); } });
    return () => { active = false; };
  }, []);

  const subjects = Array.from(new Set((gigs || []).map(gig => gig.subject)));
  const filtered = (gigs || []).filter(gig => {
    const text = `${gig.title} ${gig.description} ${gig.subject} ${gig.topic} ${gig.teacher?.user?.name || ''} ${gig.tags.join(' ')}`.toLocaleLowerCase('bn');
    return (subject === 'সব গিগ' || gig.subject === subject) && (!query.trim() || text.includes(query.trim().toLocaleLowerCase('bn')));
  }).sort((a, b) => {
    if (sort === 'price') return (a.packages[0]?.price || 0) - (b.packages[0]?.price || 0);
    if (sort === 'rating') return (b.teacher?.rating || 0) - (a.teacher?.rating || 0);
    return (b.teacher?.gigViews || 0) - (a.teacher?.gigViews || 0) || (b.teacher?.rating || 0) - (a.teacher?.rating || 0);
  });

  return <section className="page section marketplace-page">
    <div className="gig-market-hero">
      <div className="gig-market-copy">
        <p className="eyebrow">শিখুন নিজের গতিতে</p>
        <h1>দক্ষ শিক্ষকের তৈরি<br/><span>জনপ্রিয় গিগ</span></h1>
        <p className="gig-market-lead">বিষয়ভিত্তিক ক্লাস প্যাকেজ বেছে নিন, শিক্ষকের প্রোফাইল দেখুন, তারপর আপনার সুবিধামতো শেখা শুরু করুন।</p>
        <div className="gig-market-proof"><span><b>{gigs === null ? '—' : bn(gigs.length)}</b>টি শেখার প্যাকেজ</span><i/><span><b>{gigs === null ? '—' : bn(new Set(gigs.map(gig => gig.teacherId)).size)}</b>জন শিক্ষক</span><i/><span>প্যাকেজের মূল্য আগে থেকেই জানা</span></div>
      </div>
      <div className="gig-market-art" aria-hidden="true"><span className="gig-art-orbit orbit-one"/><span className="gig-art-orbit orbit-two"/><span className="gig-art-book">শিখি<br/><b>প্রতিদিন</b></span><span className="gig-art-pencil">✦</span><span className="gig-art-caption">জ্ঞান · অনুশীলন · অগ্রগতি</span></div>
    </div>

    <div className="gig-market-toolbar">
      <label className="gig-market-search"><span aria-hidden="true">⌕</span><input value={query} onChange={event => { setQuery(event.target.value); setVisibleCount(12); }} placeholder="বিষয়, টপিক বা শিক্ষকের নাম খুঁজুন" aria-label="বিষয়, টপিক বা শিক্ষকের নাম খুঁজুন"/></label>
      <label className="gig-market-sort"><span>সাজান</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="popular">জনপ্রিয়তা</option><option value="rating">শিক্ষকের রেটিং</option><option value="price">কম মূল্য আগে</option></select></label>
    </div>

    <div className="gig-market-heading"><div><p className="eyebrow">আপনার শেখার পরের ধাপ</p><h2>শিক্ষকদের শেখার প্যাকেজ</h2></div><span>{gigs === null ? 'লোড হচ্ছে…' : `${bn(filtered.length)}টি গিগ`}</span></div>
    <div className="gig-market-categories" aria-label="বিষয় দিয়ে গিগ বাছাই">
      {['সব গিগ', ...subjects].map(item => <button key={item} className={subject === item ? 'active' : ''} onClick={() => { setSubject(item); setVisibleCount(12); }}>{item === 'সব গিগ' ? 'সব বিষয়' : item}<span>{item === 'সব গিগ' ? bn(gigs?.length || 0) : bn(gigs?.filter(gig => gig.subject === item).length || 0)}</span></button>)}
    </div>

    {gigs === null ? <Loading/> : error ? <div className="gig-market-empty"><span>⌁</span><h3>গিগ লোড হয়নি</h3><p>{error}</p></div> : filtered.length ? <>
      <div className="gig-market-grid">{filtered.slice(0, visibleCount).map((gig, index) => <article className="market-gig-card" key={gig.id}>
        <button className={`market-gig-cover tone-${gigSubjectTones[gig.subject] || 'default'}`} onClick={() => go(`/gig/${gig.id}`)} aria-label={`${gig.title} গিগটি দেখুন`}>
          <span className="market-gig-cover-label">{gig.subject} <i>·</i> {gig.level}</span><span className="market-gig-cover-mark">{gigSubjectIcons[gig.subject] || '✦'}</span><span className="market-gig-cover-topic">{gig.topic}</span><span className="market-gig-cover-index">{String(index + 1).padStart(2, '0')}</span>
        </button>
        <div className="market-gig-body">
          <div className="market-gig-tags">{gig.tags.slice(0, 2).map(tag => <span key={tag}>{tag}</span>)}{gig.trial?.enabled && <span className="trial-tag">ট্রায়াল ক্লাস</span>}</div>
          <button className="market-gig-title" onClick={() => go(`/gig/${gig.id}`)}>{gig.title}</button>
          <p className="market-gig-description">{gig.description}</p>
          {gig.teacher && <button className="market-gig-teacher" onClick={() => go(`/teacher/${gig.teacher!.id}`)}><Avatar name={gig.teacher.user.name} size="sm" teacherId={gig.teacher.id}/><span className="market-gig-teacher-copy"><b>{gig.teacher.user.name}{gig.teacher.verified && <i aria-label="যাচাইকৃত শিক্ষক">✓</i>}</b><small>{gig.teacher.headline}</small></span><span className="market-gig-rating">★ {gig.teacher.rating.toFixed(1)}</span></button>}
          <div className="market-gig-footer"><div><small>শুরু হচ্ছে</small><b>{money(gig.packages[0]?.price || 0)}<span> / ক্লাস</span></b></div><button className="button" onClick={() => go(`/gig/${gig.id}`)}>গিগ দেখুন <span aria-hidden="true">↗</span></button></div>
        </div>
      </article>)}</div>
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
  const [rating,setRating]=useState('');
  const [verified,setVerified]=useState(false);
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
    else {setLoading(true);setTeachers([]);}
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
    setLoading(true);setLoadingMore(false);setTeachers([]);setError('');
    try {
      const data=await api<Teacher[]>(`/matches?${new URLSearchParams({subject,q,budget:'700',language:'বাংলা'}).toString()}`);
      setTeachers(data);setTotal(data.length);setPage(1);setHasMore(false);
    } catch (e) {
      setError(e instanceof Error?e.message:'স্মার্ট ম্যাচিং করা যায়নি। আবার চেষ্টা করুন।');
      setTotal(0);setHasMore(false);
    } finally {setLoading(false);}
  };

  const reset=()=>{
    const defaults={q:'',subject:'',rating:'',verified:false};
    setQ('');setSubject('');setRating('');setVerified(false);
    void load(defaults);
  };
  const toggle=(teacher:Teacher)=>setCompare(current=>current.some(item=>item.id===teacher.id)?current.filter(item=>item.id!==teacher.id):current.length<3?[...current,teacher]:current);

  return <section className="page section teacher-search-page">
    <header className="teacher-search-intro">
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

    <div className="teacher-results-heading"><div><p className="eyebrow">আপনার শেখার সঙ্গী</p><h2>শিক্ষকরা</h2></div><span className="teacher-result-count">{loading&&teachers.length===0?'খোঁজা হচ্ছে…':`${bn(total)} জন শিক্ষক`}</span></div>
    {error&&<p className="teacher-search-error" role="alert">{error}</p>}
    {loading&&teachers.length===0?<Loading/>:teachers.length?<>
      <div className="card-grid teacher-search-results">{teachers.map(teacher=><TeacherCard key={teacher.id} teacher={teacher} user={user} compare={compare.some(item=>item.id===teacher.id)} onCompare={toggle}/>)}</div>
      {hasMore&&<div className="teacher-load-more"><span>{bn(teachers.length)} / {bn(total)} জন শিক্ষক দেখানো হচ্ছে</span><button className="quiet-btn" type="button" disabled={loadingMore} onClick={()=>void load(filters,page+1,true)}>{loadingMore?'আরও শিক্ষক আসছে…':'আরও শিক্ষক দেখুন ↓'}</button></div>}
    </>:!loading&&!error?<Empty>আপনার খোঁজার সঙ্গে মেলে এমন শিক্ষক পাওয়া যায়নি। ফিল্টার বদলে আবার চেষ্টা করুন।</Empty>:null}
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
    <div className="compare-heading"><div><p className="eyebrow">শিক্ষক তুলনা</p><h1>শিক্ষক নির্বাচন সহজ করুন</h1><p>রেটিং, অভিজ্ঞতা, শিক্ষা ও ফি পাশাপাশি মিলিয়ে দেখুন।</p></div><span className="compare-count"><b>{bn(items.length)}</b> জন শিক্ষক</span></div>
    <div className="compare-table-wrap" role="region" aria-label="শিক্ষক তুলনার ছক" tabIndex={0}>
      <table className="compare-table" aria-label="শিক্ষক তুলনা">
        <thead><tr><th scope="col" className="compare-topic"><span>তুলনার বিষয়</span><small>প্রয়োজনীয় তথ্য</small></th>{items.map(teacher => <th scope="col" key={teacher.id}><div className="compare-person"><Avatar name={teacher.user.name} size="lg" teacherId={teacher.id}/><div className="compare-person-info"><b>{teacher.user.name}</b><p>{teacher.headline}</p><span className={`compare-status ${teacher.verified ? 'is-verified' : 'is-pending'}`}>{teacher.verified ? '✓ যাচাইকৃত' : 'যাচাই চলছে'}</span></div></div></th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.key}><th scope="row">{row.label}</th>{items.map(teacher => <td key={`${row.key}-${teacher.id}`}>{row.render(teacher)}</td>)}</tr>)}</tbody>
      </table>
    </div>
    <p className="compare-hint">মোবাইলে ছকটি পাশের দিকে সরিয়ে অন্য শিক্ষক দেখুন। আরও শিক্ষক যোগ করতে শিক্ষক খোঁজার পাতায় ফিরে যান।</p>
  </section>;
}

export function TeacherPage({user}:{user:User|null}) { const id=location.hash.split('/')[2]?.split('?')[0];const [teacher,setTeacher]=useState<Teacher|null>(null);const [booking,setBooking]=useState<Gig|null>(null);useEffect(()=>{if(id)void api<Teacher>(`/teachers/${id}`).then(setTeacher);},[id]);useEffect(()=>{if(!teacher)return;let secondFrame=0;const firstFrame=requestAnimationFrame(()=>{secondFrame=requestAnimationFrame(()=>window.scrollTo(0,0));});return()=>{cancelAnimationFrame(firstFrame);cancelAnimationFrame(secondFrame);};},[teacher]);if(!teacher)return <Loading/>;return <section className="page"><div className="profile-hero"><Avatar name={teacher.user.name} size="lg" teacherId={teacher.id}/><div><p className="eyebrow">{teacher.level}</p><h1>{teacher.user.name} {teacher.verified&&<em className="verified">✓ যাচাইকৃত</em>}</h1><p>{teacher.headline}</p><div className="profile-stats"><span>★ {teacher.rating} রেটিং</span><span>{teacher.experienceYears} বছরের অভিজ্ঞতা</span><span>{money(teacher.hourlyRate)} / ঘণ্টা</span></div></div><div className="profile-cta"><button className="button" onClick={()=>teacher.gigs?.[0]&&setBooking(teacher.gigs[0])}>ক্লাস বুক করুন</button><button className="quiet-btn" onClick={()=>go('/messages')}>বার্তা পাঠান</button></div></div><div className="profile-layout"><div className="profile-content"><Info title="পরিচিতি"><p>{teacher.bio}</p></Info><Info title="শিক্ষাগত যোগ্যতা"><p>{teacher.education} — {teacher.institution}</p></Info><Info title="বিষয় ও দক্ষতা"><div className="chips">{[...teacher.subjects,...teacher.skills].map(x=><span key={x}>{x}</span>)}</div></Info><Info title="পড়ানোর পদ্ধতি"><p>লাইভ ইন্টারঅ্যাক্টিভ ক্লাস, উদাহরণভিত্তিক ব্যাখ্যা এবং ক্লাস-পরবর্তী নোট।</p></Info><Info title="ডেমো ক্লাস">{teacher.demoUrl?<iframe className="video" src={teacher.demoUrl} title="ডেমো ক্লাস" allowFullScreen/>:<Empty>এখনও ডেমো ক্লাস যোগ করা হয়নি।</Empty>}</Info><Info title="শিক্ষকের গিগ স্টোরফ্রন্ট"><div className="teacher-gig-storefront">{teacher.gigs?.map(g=><TeacherGigCard key={g.id} gig={g} onBook={()=>setBooking(g)}/>)}</div></Info></div><aside className="aside-card"><h3>সময়সূচি</h3>{Object.entries(teacher.availability).map(([d,t])=><p key={d}><b>{d}</b><br/>{t.join(' • ')}</p>)}<hr/><p>ভাষা: {teacher.languages.join(', ')}</p><p>অবস্থান: {teacher.location}</p></aside></div>{booking&&(user?.role==='STUDENT'?<BookingModal gig={booking} onClose={()=>setBooking(null)} onDone={bid=>go(`/payment/${bid}`)}/>:<LoginHint onClose={()=>setBooking(null)}/>)}</section> }

function TeacherGigCard({gig,onBook}:{gig:Gig;onBook:()=>void}) { return <article className="teacher-gig-card"><div className="teacher-gig-card-head"><div><span className="preview-badge">{gig.subject} · {gig.level}</span><h3>{gig.title}</h3><p>{gig.description}</p></div><strong>{gig.badges?.[0]||'শিক্ষক সেবা'}</strong></div><div className="chips">{gig.tags.map(tag=><span key={tag}>{tag}</span>)}{gig.classType&&<span>{gig.classType}</span>}{gig.duration&&<span>{bn(gig.duration)} মিনিট</span>}{gig.trial?.enabled&&<span>ট্রায়াল ক্লাস</span>}</div>{gig.outcomes?.length&&<div className="gig-detail-block"><b>শিক্ষার্থী যা শিখবেন</b><ul>{gig.outcomes.filter(Boolean).map(outcome=><li key={outcome}>{outcome}</li>)}</ul></div>}<div className="gig-package-grid">{gig.packages.map(pack=><div className="teacher-gig-package" key={pack.id}><b>{pack.name}</b><span>{bn(pack.classes)}টি ক্লাস · {bn(pack.duration)} মিনিট</span><strong>{money(pack.price)}</strong><small>{pack.features.join(' · ')}</small></div>)}</div>{gig.extras?.length&&<div className="gig-detail-block"><b>অতিরিক্ত সেবা</b><p>{gig.extras.map(extra=>`${extra.name} (${money(extra.price)})`).join(' · ')}</p></div>}{gig.media?.length&&<div className="gig-detail-block"><b>মিডিয়া ও উপকরণ</b><p>{gig.media.map(media=>media.caption||media.kind).join(' · ')}</p></div>}{gig.faqs.length>0&&<details className="gig-faq"><summary>সচরাচর জিজ্ঞাসা ({bn(gig.faqs.length)})</summary>{gig.faqs.map(faq=><p key={faq.q}><b>{faq.q}</b><br/>{faq.a}</p>)}</details>}<div className="teacher-gig-footer"><span>{gig.availability&&Object.keys(gig.availability).length?`উপলভ্য: ${Object.keys(gig.availability).join(', ')}`:'সময় শিক্ষককে জিজ্ঞাসা করুন'}</span><button className="button" onClick={onBook}>প্যাকেজ বেছে বুক করুন</button></div></article> }
function Info({title,children}:{title:string;children:React.ReactNode}) {return <section className="info"><h2>{title}</h2>{children}</section>}
function LoginHint({onClose}:{onClose:()=>void}){return <div className="modal-back"><section className="modal"><button className="close" onClick={onClose}>×</button><h2>বুকিং করতে লগইন করুন</h2><p>ক্লাস বুক করতে শিক্ষার্থী হিসেবে লগইন বা নিবন্ধন করুন।</p><button className="button wide" onClick={()=>go('/login')}>লগইন করুন</button></section></div>}

export function GigPage({user}:{user:User|null}) { const id=location.hash.split('/')[2]?.split('?')[0];const [gig,setGig]=useState<Gig|null>(null);const [booking,setBooking]=useState(false);useEffect(()=>{if(id)void api<Gig>(`/gigs/${id}`).then(setGig);},[id]);if(!gig)return <Loading/>;return <section className="page section"><p className="eyebrow">{gig.subject} • {gig.level}</p><h1>{gig.title}</h1><p className="lead">{gig.description}</p><div className="gig-page-grid"><div>{gig.demoUrl&&<iframe className="video" src={gig.demoUrl} title="ডেমো ক্লাস" allowFullScreen/>}<Info title="যা যা পাবেন"><ul>{gig.includes.map(x=><li key={x}>{x}</li>)}</ul></Info><Info title="শিক্ষার্থীর জন্য প্রয়োজনীয়তা"><p>{gig.requirements}</p></Info><Info title="সচরাচর জিজ্ঞাসা">{gig.faqs.map(x=><details key={x.q}><summary>{x.q}</summary><p>{x.a}</p></details>)}</Info></div><aside className="package-box"><h2>প্যাকেজ বেছে নিন</h2>{gig.packages.map(p=><article key={p.id}><h3>{p.name}</h3><p>{p.classes}টি ক্লাস • {p.duration} মিনিট</p><b>{money(p.price)}</b><ul>{p.features.map(f=><li key={f}>{f}</li>)}</ul></article>)}<button className="button wide" onClick={()=>setBooking(true)}>ক্লাস বুক করুন</button><p className="help">ডেমো পেমেন্ট — শুধুমাত্র লোকাল পরীক্ষার জন্য</p></aside></div>{booking&&(user?.role==='STUDENT'?<BookingModal gig={gig} onClose={()=>setBooking(false)} onDone={bid=>go(`/payment/${bid}`)}/>:<LoginHint onClose={()=>setBooking(false)}/>)}</section> }

export function AuthPage({ kind, onLogin }: { kind: 'login' | 'register'; onLogin: (user: User) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState(kind === 'login' ? 'student@demo.local' : '');
  const [password, setPassword] = useState(kind === 'login' ? 'demo123' : '');
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
      go('/dashboard');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'সমস্যা হয়েছে');
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
          <p className="eyebrow auth-demo-label"><span aria-hidden="true" />সম্পূর্ণ লোকাল ডেমো</p>
          <h2>শেখা ও শেখানোর সহজ শুরু</h2>
          <p className="auth-description">শিক্ষক খোঁজা, শেখার সেবা, বুকিং আর ক্লাসরুম—সবকিছু ঘুরে দেখুন। এটি একটি ডেমো পরিবেশ; এখানে কোনো আসল পেমেন্ট নেওয়া হয় না।</p>
        </div>

        <section className="demo-account-panel" aria-labelledby="demo-account-title">
          <div className="demo-account-heading">
            <div>
              <h3 id="demo-account-title">ডেমো অ্যাকাউন্ট বেছে নিন</h3>
              <p>একটি বাছলে লগইন তথ্য বসবে—তারপর লগইন করুন।</p>
            </div>
            <span className="demo-count">৪টি প্রোফাইল</span>
          </div>
          <div className="demo-accounts">
            <button type="button" onClick={() => chooseDemo('student@demo.local')}>
              <span className="demo-role-icon" aria-hidden="true">শি</span>
              <span className="demo-role-copy"><b>শিক্ষার্থী</b><small>শিখতে শুরু করুন</small></span>
              <span className="demo-role-arrow" aria-hidden="true">↗</span>
            </button>
            <button type="button" onClick={() => chooseDemo('teacher@demo.local')}>
              <span className="demo-role-icon" aria-hidden="true">শি</span>
              <span className="demo-role-copy"><b>শিক্ষক</b><small>শিক্ষক ড্যাশবোর্ড</small></span>
              <span className="demo-role-arrow" aria-hidden="true">↗</span>
            </button>
            <button type="button" onClick={() => chooseDemo('parent@demo.local')}>
              <span className="demo-role-icon" aria-hidden="true">অ</span>
              <span className="demo-role-copy"><b>অভিভাবক</b><small>শেখার অগ্রগতি দেখুন</small></span>
              <span className="demo-role-arrow" aria-hidden="true">↗</span>
            </button>
            <button type="button" onClick={() => chooseDemo('admin@demo.local')}>
              <span className="demo-role-icon" aria-hidden="true">অ</span>
              <span className="demo-role-copy"><b>অ্যাডমিন</b><small>ডেমো পরিচালনা</small></span>
              <span className="demo-role-arrow" aria-hidden="true">↗</span>
            </button>
          </div>
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
          {kind === 'login' && <p className="help">ডেমো অ্যাকাউন্ট বেছে নিলে ইমেইল ও পাসওয়ার্ড এখানে বসবে।</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button wide" disabled={busy}>{busy ? 'অপেক্ষা করুন…' : kind === 'login' ? 'লগইন করুন' : 'অ্যাকাউন্ট তৈরি করুন'}</button>
        </form>
        <p className="auth-switch">{kind === 'login' ? 'অ্যাকাউন্ট নেই?' : 'ইতোমধ্যে নিবন্ধিত?'} <a href={kind === 'login' ? '#/register' : '#/login'}>{kind === 'login' ? 'নিবন্ধন করুন' : 'লগইন করুন'}</a></p>
      </div>
    </section>
  );
}

type DashboardData={user:User;bookings:Booking[];notifications:Notification[];unread:number;teacher?:Teacher;wallet?:{total:number;pending:number;commission:number;entries:any[]};gigs?:Gig[];analytics?:Record<string,number>;favorites?:any[];attempts?:any[];children?:{name:string;bookings:Booking[];attempts:any[]}[];admin?:{users:number;teachers:number;pending:number;payments:number;reports:number}};
export function Dashboard({user}:{user:User}) { const [data,setData]=useState<DashboardData|null>(null);useEffect(()=>{void api<DashboardData>('/dashboard').then(setData);},[]);if(!data)return <Loading/>;if(user.role==='TEACHER')return <TeacherDashboard data={data}/>;if(user.role==='PARENT')return <ParentDashboard data={data}/>;if(user.role==='ADMIN'||user.role==='SUPER_ADMIN')return <AdminDashboard data={data}/>;return <StudentDashboard data={data}/>; }
const BookingList=({bookings}:{bookings:Booking[]})=><div className="booking-list">{bookings.slice(0,5).map(b=><article key={b.id}><span className={`status ${b.status}`}>{statusBn(b.status)}</span><div><b>{shortDate(b.date)} • {b.time}</b><p>{money(b.price)} • বুকিং #{b.id.slice(-5)}</p></div><div className="booking-actions">{['CONFIRMED','IN_PROGRESS'].includes(b.status)&&<button className="button small" onClick={()=>go(`/classroom/${b.id}`)}>ক্লাসে যান</button>}<button className="quiet-btn" onClick={()=>go(`/booking/${b.id}`)}>বিস্তারিত</button></div></article>)}</div>;
const Stat=({label,value,accent}:{label:string;value:string|number;accent?:string})=><article className="stat"><small>{label}</small><b className={accent}>{value}</b></article>;
function StudentDashboard({data}:{data:DashboardData}){const completed=data.bookings.filter(b=>b.status==='COMPLETED').length;const avg=data.attempts?.length?Math.round(data.attempts.reduce((n,a)=>n+(a.score/a.total)*100,0)/data.attempts.length):0;return <section className="page section"><p className="eyebrow">শিক্ষার্থী ড্যাশবোর্ড</p><h1>স্বাগতম, {data.user.name}</h1><div className="stats"><Stat label="মোট ক্লাস" value={bn(data.bookings.length)}/><Stat label="সম্পন্ন ক্লাস" value={bn(completed)} accent="green"/><Stat label="পরীক্ষার গড়" value={`${bn(avg)}%`} accent="purple"/><Stat label="সংরক্ষিত শিক্ষক" value={bn(data.favorites?.length||0)}/></div><div className="dashboard-grid"><Info title="আসন্ন ও সাম্প্রতিক ক্লাস"><BookingList bookings={data.bookings}/><a href="#/bookings">সব বুকিং দেখুন →</a></Info><Info title="সাম্প্রতিক নোটিফিকেশন"><Notifications items={data.notifications}/></Info></div><div className="quick-actions"><button onClick={()=>go('/search')}>⌕<span>শিক্ষক খুঁজুন</span></button><button onClick={()=>go('/exams')}>✎<span>পরীক্ষা দিন</span></button><button onClick={()=>go('/problems')}>◈<span>সমস্যা পোস্ট করুন</span></button><button onClick={()=>go('/messages')}>✉<span>বার্তা দেখুন</span></button></div></section>}
function TeacherDashboard({data}:{data:DashboardData}){const [profileOpen,setProfileOpen]=useState(false);const liveBooking=data.bookings.find(b=>['CONFIRMED','IN_PROGRESS'].includes(b.status));return <section className="page section"><p className="eyebrow">শিক্ষক ড্যাশবোর্ড</p><h1>স্বাগতম, {data.user.name}</h1><div className="stats"><Stat label="প্রোফাইল দেখা হয়েছে" value={bn(data.analytics?.profileViews||0)}/><Stat label="গিগ দেখা হয়েছে" value={bn(data.analytics?.gigViews||0)}/><Stat label="নিশ্চিত বুকিং" value={bn(data.bookings.filter(b=>b.status==='CONFIRMED').length)} accent="green"/><Stat label="ডেমো প্রাপ্য" value={money(data.wallet?.pending||0)} accent="purple"/></div><div className="dashboard-grid"><Info title="আজকের বুকিং"><BookingList bookings={data.bookings}/><a href="#/bookings">সব বুকিং দেখুন →</a></Info><Info title="দ্রুত কাজ"><div className="stack">{liveBooking&&<button className="button wide" onClick={()=>go(`/classroom/${liveBooking.id}`)}>লাইভ ক্লাসে যোগ দিন</button>}<button className="button wide" onClick={()=>go('/teacher/exams/new')}>নতুন পরীক্ষা তৈরি করুন</button><button className="quiet-btn wide" onClick={()=>go('/teacher/exams')}>পরীক্ষা পরিচালনা করুন</button><button className="button wide" onClick={()=>go('/teacher/gigs/new')}>নতুন গিগ তৈরি করুন</button><button className="quiet-btn wide" onClick={()=>setProfileOpen(true)}>প্রোফাইল ও সময়সূচি সম্পাদনা</button><button className="quiet-btn wide" onClick={()=>go('/wallet')}>ডেমো ওয়ালেট দেখুন</button></div></Info></div><Info title="আমার গিগ">{data.gigs?.length?<div className="gig-list">{data.gigs.map(g=><article key={g.id}><div><b>{g.title}</b><p>{money(g.packages[0].price)} থেকে</p></div><button className="quiet-btn" onClick={()=>go(`/gig/${g.id}`)}>দেখুন</button></article>)}</div>:<Empty>এখনও কোনো গিগ নেই।</Empty>}</Info>{profileOpen&&<ProfileForm teacher={data.teacher!} onClose={()=>setProfileOpen(false)}/>}</section>}
function ParentDashboard({data}:{data:DashboardData}){return <section className="page section"><p className="eyebrow">অভিভাবক ড্যাশবোর্ড</p><h1>সন্তানের শেখার অগ্রগতি</h1>{data.children?.length?data.children.map(c=><div className="child-card" key={c.name}><div><Avatar name={c.name}/><h2>{c.name}</h2></div><div><b>{bn(c.bookings.length)}</b><small>মোট ক্লাস</small></div><div><b>{bn(c.attempts.length)}</b><small>পরীক্ষা</small></div><button className="button" onClick={()=>go('/bookings')}>বিস্তারিত দেখুন</button></div>):<Empty>এখনও কোনো শিক্ষার্থী যুক্ত করা হয়নি।</Empty>}<Info title="ডেমো ব্যয়ের সারাংশ"><p>এই লোকাল ডেমোতে সন্তানের সব বুকিং ও পেমেন্ট ইতিহাস এখান থেকে দেখা যাবে।</p><button className="quiet-btn" onClick={()=>go('/bookings')}>বুকিং ইতিহাস দেখুন</button></Info></section>}
function AdminDashboard({data}:{data:DashboardData}){const [pending,setPending]=useState<Teacher[]>([]);const load=()=>void api<Teacher[]>('/admin/teachers/pending').then(setPending);useEffect(load,[]);const action=async(id:string,status:string)=>{await post(`/admin/teachers/${id}/verification`,{status});load();};return <section className="page section"><p className="eyebrow">অ্যাডমিন ড্যাশবোর্ড</p><h1>প্ল্যাটফর্ম ব্যবস্থাপনা</h1><div className="stats"><Stat label="মোট ব্যবহারকারী" value={bn(data.admin?.users||0)}/><Stat label="শিক্ষক" value={bn(data.admin?.teachers||0)}/><Stat label="অপেক্ষমাণ যাচাই" value={bn(data.admin?.pending||0)} accent="purple"/><Stat label="ডেমো পেমেন্ট" value={bn(data.admin?.payments||0)} accent="green"/></div><Info title="শিক্ষক যাচাইকরণ অনুরোধ">{pending.length?<div className="admin-list">{pending.map(t=><article key={t.id}><div><b>{t.user.name}</b><p>{t.education||'শিক্ষাগত তথ্য অসম্পূর্ণ'} • {t.institution||'প্রতিষ্ঠান নেই'}</p></div><button className="button small" onClick={()=>void action(t.id,'APPROVED')}>অনুমোদন</button><button className="danger-btn" onClick={()=>void action(t.id,'REJECTED')}>প্রত্যাখ্যান</button></article>)}</div>:<Empty>এই মুহূর্তে কোনো যাচাইকরণ অনুরোধ নেই।</Empty>}</Info><div className="quick-actions"><button onClick={()=>go('/bookings')}>▣<span>বুকিং দেখুন</span></button><button onClick={()=>go('/problems')}>◈<span>রিপোর্ট ও সমস্যা</span></button><button onClick={()=>go('/search')}>♙<span>শিক্ষক দেখুন</span></button></div></section>}
function Notifications({items}:{items:Notification[]}){return items.length?<ul className="notice-list">{items.slice(0,5).map(n=><li key={n.id}><b>{n.title}</b><p>{n.body}</p><small>{shortDate(n.createdAt)}</small></li>)}</ul>:<Empty>নতুন কোনো নোটিফিকেশন নেই।</Empty>}
function ProfileForm({teacher,onClose}:{teacher:Teacher;onClose:()=>void}){const [form,setForm]=useState({headline:teacher.headline,bio:teacher.bio,education:teacher.education,institution:teacher.institution,location:teacher.location,hourlyRate:String(teacher.hourlyRate),sessionPrice:String(teacher.sessionPrice ?? teacher.hourlyRate),demoUrl:teacher.demoUrl,availability:Object.entries(teacher.availability||{}).map(([day,slots])=>`${day}: ${slots.join(', ')}`).join('\n')});const [message,setMessage]=useState('');const parseAvailability=(raw:string)=>{const next:Record<string,string[]>={};for(const line of raw.split(/\n|;/).map(x=>x.trim()).filter(Boolean)){const idx=line.indexOf(':');if(idx<0)continue;const day=line.slice(0,idx).trim();const slots=line.slice(idx+1).split(',').map(v=>v.trim()).filter(Boolean);if(day)next[day]=slots;}return next;};const save=async(e:React.FormEvent)=>{e.preventDefault();const availability=parseAvailability(form.availability);await put('/teacher/availability',{sessionPrice:Number(form.sessionPrice),availability});setMessage('প্রোফাইল ও লাইভ সময়সূচি সফলভাবে সংরক্ষিত হয়েছে।');};return <div className="modal-back"><section className="modal"><button className="close" onClick={onClose}>×</button><h2>প্রোফাইল সম্পাদনা</h2><form onSubmit={save}><label>শিরোনাম<input value={form.headline} onChange={e=>setForm({...form,headline:e.target.value})}/></label><label>পরিচিতি<textarea value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})}/></label><div className="two"><label>শিক্ষা<input value={form.education} onChange={e=>setForm({...form,education:e.target.value})}/></label><label>প্রতিষ্ঠান<input value={form.institution} onChange={e=>setForm({...form,institution:e.target.value})}/></label></div><div className="two"><label>অবস্থান<input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label><label>প্রতি ঘণ্টার মূল্য<input type="number" value={form.hourlyRate} onChange={e=>setForm({...form,hourlyRate:e.target.value})}/></label></div><div className="two"><label>সেশন ফি<input type="number" value={form.sessionPrice} onChange={e=>setForm({...form,sessionPrice:e.target.value})}/></label><label>লাইভ স্ট্যাটাস<input value={teacher.isLive ? 'লাইভ' : 'অফলাইনে'} readOnly/></label></div><label>সময়সূচি (যেমন: সোমবার: ১০:০০, ১৬:০০)<textarea value={form.availability} onChange={e=>setForm({...form,availability:e.target.value})} rows={5}/></label><label>ডেমো ভিডিওর YouTube এম্বেড URL<input value={form.demoUrl} onChange={e=>setForm({...form,demoUrl:e.target.value})}/></label>{message&&<p className="success">{message}</p>}<button className="button wide">সংরক্ষণ করুন</button></form></section></div>}
function GigForm({onClose}:{onClose:()=>void}){const [f,setF]=useState({title:'',description:'',subject:'',topic:'',level:'HSC',price:'500'});const [message,setMessage]=useState('');const save=async(e:React.FormEvent)=>{e.preventDefault();await post('/teacher/gigs',{...f,price:Number(f.price)});setMessage('নতুন গিগ তৈরি হয়েছে।');};return <div className="modal-back"><section className="modal"><button className="close" onClick={onClose}>×</button><h2>নতুন গিগ তৈরি করুন</h2><form onSubmit={save}><label>শিরোনাম<input value={f.title} onChange={e=>setF({...f,title:e.target.value})} required/></label><label>বর্ণনা<textarea value={f.description} onChange={e=>setF({...f,description:e.target.value})} required/></label><div className="two"><label>বিষয়<input value={f.subject} onChange={e=>setF({...f,subject:e.target.value})} required/></label><label>টপিক<input value={f.topic} onChange={e=>setF({...f,topic:e.target.value})} required/></label></div><div className="two"><label>শিক্ষার স্তর<input value={f.level} onChange={e=>setF({...f,level:e.target.value})} required/></label><label>বেসিক মূল্য<input type="number" value={f.price} onChange={e=>setF({...f,price:e.target.value})} required/></label></div>{message&&<p className="success">{message}</p>}<button className="button wide">গিগ প্রকাশ করুন</button></form></section></div>}

void GigForm;
const statusBn=(status:string)=>({PENDING:'অপেক্ষমাণ',CONFIRMED:'নিশ্চিত',IN_PROGRESS:'চলমান',COMPLETED:'সম্পন্ন',CANCELLED:'বাতিল',NO_SHOW:'উপস্থিত হয়নি',DISPUTED:'বিরোধপূর্ণ',REFUNDED:'ফেরত দেওয়া হয়েছে'}[status]||status);
export function Bookings({user}:{user:User}) { const [items,setItems]=useState<Booking[]|null>(null);const [notes,setNotes]=useState<Record<string,string>>({});const load=()=>void api<Booking[]>('/bookings').then(setItems);useEffect(load,[]);const status=async(b:Booking,s:string)=>{await post(`/bookings/${b.id}/status`,{status:s});load();};const saveNote=async(b:Booking)=>{await post(`/bookings/${b.id}/notes`,{notes:notes[b.id]});load();};if(!items)return <Loading/>;return <section className="page section"><p className="eyebrow">ক্লাস ব্যবস্থাপনা</p><h1>আমার বুকিং</h1>{items.length?<div className="full-bookings">{items.map(b=><article key={b.id}><div className="booking-top"><div><span className={`status ${b.status}`}>{statusBn(b.status)}</span><h3>{shortDate(b.date)} • {b.time}</h3><p>{money(b.price)} • আইডি: {b.id.slice(-8)}</p></div><div className="booking-actions">{user.role==='STUDENT'&&b.status==='PENDING'&&<button className="button" onClick={()=>go(`/payment/${b.id}`)}>পেমেন্ট করুন</button>}{['CONFIRMED','IN_PROGRESS'].includes(b.status)&&<button className="button" onClick={()=>go(`/classroom/${b.id}`)}>ক্লাসরুম</button>}{user.role==='TEACHER'&&b.status==='CONFIRMED'&&<button className="quiet-btn" onClick={()=>void status(b,'IN_PROGRESS')}>ক্লাস শুরু</button>}{user.role==='TEACHER'&&b.status==='IN_PROGRESS'&&<button className="quiet-btn" onClick={()=>void status(b,'COMPLETED')}>ক্লাস শেষ</button>}</div></div><div className="history">{b.history.map(h=><span key={h.at}>{statusBn(h.status)} · {shortDate(h.at)}</span>)}</div>{b.notes&&<div className="note-box"><b>ক্লাস নোট</b><p>{b.notes}</p></div>}{b.recording&&<div className="note-box"><b>লোকাল রেকর্ডিং</b><p>{b.recording.name} · {bn(b.recording.duration)} সেকেন্ড</p></div>}{user.role==='TEACHER'&&<form className="inline-form" onSubmit={e=>{e.preventDefault();void saveNote(b)}}><input value={notes[b.id]||''} onChange={e=>setNotes({...notes,[b.id]:e.target.value})} placeholder="ক্লাস নোট যোগ করুন"/><button className="quiet-btn">নোট সংরক্ষণ</button></form>}{user.role==='STUDENT'&&b.status==='COMPLETED'&&<ReviewForm booking={b}/>}</article>)}</div>:<Empty>এখনও কোনো বুকিং নেই। পছন্দের শিক্ষক খুঁজে ক্লাস বুক করুন।</Empty>}</section> }
function ReviewForm({booking}:{booking:Booking}){const [comment,setComment]=useState('');const [rating,setRating]=useState('5');const [message,setMessage]=useState('');const submit=async(e:React.FormEvent)=>{e.preventDefault();try{await post('/reviews',{bookingId:booking.id,rating:Number(rating),comment});setMessage('আপনার রিভিউ সংরক্ষিত হয়েছে।');}catch(e){setMessage(e instanceof Error?e.message:'সমস্যা হয়েছে');}};return <form className="review-form" onSubmit={submit}><b>ক্লাসের রিভিউ দিন</b><select value={rating} onChange={e=>setRating(e.target.value)}>{[5,4,3,2,1].map(x=><option key={x} value={x}>{x} তারকা</option>)}</select><input value={comment} onChange={e=>setComment(e.target.value)} placeholder="আপনার অভিজ্ঞতা লিখুন" required/>{message?<p className="success">{message}</p>:<button className="quiet-btn">রিভিউ জমা দিন</button>}</form>}

export function PaymentPage({user}:{user:User}){const bookingId=location.hash.split('/')[2];const [booking,setBooking]=useState<Booking|null>(null);const [done,setDone]=useState<any>(null);const [error,setError]=useState('');useEffect(()=>{void api<Booking[]>('/bookings').then(b=>setBooking(b.find(x=>x.id===bookingId)||null));},[bookingId]);const pay=async()=>{setError('');try{setDone(await post(`/bookings/${bookingId}/pay`));}catch(e){setError(e instanceof Error?e.message:'সমস্যা হয়েছে');}};if(!booking)return <Loading/>;if(user.role!=='STUDENT')return <section className="page section"><Empty>শুধু শিক্ষার্থী ডেমো পেমেন্ট করতে পারেন।</Empty></section>;if(done)return <section className="page section receipt"><span className="receipt-icon">✓</span><p className="eyebrow">ডেমো পেমেন্ট সফল</p><h1>আপনার বুকিং নিশ্চিত হয়েছে</h1><p>{shortDate(booking.date)} তারিখে {booking.time} টার ক্লাসটি বুক করা হয়েছে।</p><div><span>লেনদেন আইডি</span><b>{done.receipt.transactionId}</b><span>ডেমো পরিমাণ</span><b>{money(done.receipt.amount)}</b></div><p className="notice">ডেমো পেমেন্ট — শুধুমাত্র লোকাল পরীক্ষার জন্য। এখানে কোনো আসল অর্থ লেনদেন হয় না।</p><button className="button" onClick={()=>go('/bookings')}>আমার বুকিং দেখুন</button></section>;return <section className="page section payment"><p className="eyebrow">ধাপ ২ / ২</p><h1>ডেমো পেমেন্ট সম্পন্ন করুন</h1><div className="payment-card"><div><h3>বুকিং সারাংশ</h3><p>{shortDate(booking.date)} • {booking.time}</p><p>বুকিং আইডি: {booking.id.slice(-8)}</p></div><b>{money(booking.price)}</b></div><div className="demo-box"><span>🧪</span><div><h3>ডেমো পেমেন্ট</h3><p>এটি শুধু লোকাল পরীক্ষার জন্য সিমুলেটেড পেমেন্ট। আপনার কাছ থেকে কোনো অর্থ নেওয়া হবে না।</p></div></div>{error&&<p className="form-error">{error}</p>}<button className="button wide" onClick={()=>void pay()}>ডেমো পেমেন্ট সম্পন্ন করুন</button></section>}

export function Wallet(){const [data,setData]=useState<{total:number;pending:number;commission:number;entries:any[]}|null>(null);const [message,setMessage]=useState('');const load=()=>void api<typeof data>('/wallet').then(x=>setData(x as any));useEffect(load,[]);if(!data)return <Loading/>;const payout=async()=>{try{const r=await post<{message:string;amount:number}>('/wallet/payout');setMessage(`${r.message} (${money(r.amount)})`);load();}catch(e){setMessage(e instanceof Error?e.message:'সমস্যা হয়েছে');}};return <section className="page section"><p className="eyebrow">লোকাল ডেমো ওয়ালেট</p><h1>আয় ও লেনদেন</h1><div className="stats"><Stat label="মোট ডেমো প্রাপ্য" value={money(data.total)} accent="green"/><Stat label="অপেক্ষমাণ আয়" value={money(data.pending)}/><Stat label="প্ল্যাটফর্ম কমিশন" value={money(data.commission)} accent="purple"/></div><div className="wallet-box"><div><h2>ডেমো উত্তোলন</h2><p>কোনো আসল অর্থ নয়। এটি লেজার-ভিত্তিক লোকাল পরীক্ষার কার্যক্রম।</p></div><button className="button" onClick={()=>void payout()}>ডেমো উত্তোলন করুন</button></div>{message&&<p className="success">{message}</p>}<Info title="লেনদেনের ইতিহাস">{data.entries.length?<div className="ledger">{data.entries.slice().reverse().map(e=><p key={e.id}><span>{e.note}<small>{shortDate(e.createdAt)}</small></span><b className={e.amount>=0?'green':'red'}>{e.amount>=0?'+':'−'}{money(Math.abs(e.amount))}</b></p>)}</div>:<Empty>এখনও কোনো লেনদেন নেই।</Empty>}</Info></section>}

export function Messages({user}:{user:User}){const requestedId=new URLSearchParams(location.hash.split('?')[1]||'').get('with');const [items,setItems]=useState<{user:User;lastMessage?:{body:string;createdAt:string};unreadCount:number}[]>([]);const [other,setOther]=useState<User|null>(null);const [messages,setMessages]=useState<any[]>([]);const [body,setBody]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(true);useEffect(()=>{void api<typeof items>('/messages').then(conversations=>{setItems(conversations);const selected=conversations.find(item=>item.user.id===requestedId)||conversations[0];if(selected)setOther(selected.user);}).catch(e=>setError(e instanceof Error?e.message:'কথোপকথন লোড করা যায়নি।')).finally(()=>setLoading(false));},[requestedId]);useEffect(()=>{if(!other)return;setError('');void api<any[]>(`/messages/${other.id}`).then(setMessages).then(()=>post(`/messages/${other.id}/read`)).catch(e=>setError(e instanceof Error?e.message:'বার্তা লোড করা যায়নি।'));const protocol=location.protocol==='https:'?'wss':'ws';const socket=new WebSocket(`${protocol}://${location.host}/ws`);socket.onmessage=event=>{try{const packet=JSON.parse(event.data) as {type:string;data?:any};if(packet.type==='message'&&packet.data&&(packet.data.senderId===other.id||packet.data.receiverId===other.id)){setMessages(current=>current.some(item=>item.id===packet.data.id)?current:[...current,packet.data]);if(packet.data.receiverId===user.id)void post(`/messages/${other.id}/read`);}}catch{setError('বার্তার আপডেট পাওয়া যায়নি।')}};socket.onerror=()=>setError('রিয়েল-টাইম সংযোগ পাওয়া যাচ্ছে না; HTTP মোডে বার্তা পাঠানো যাবে।');return()=>socket.close();},[other,user.id]);const send=async(e:React.FormEvent)=>{e.preventDefault();if(!other||!body.trim())return;const value=body.trim();try{const protocol=location.protocol==='https:'?'wss':'ws';const socket=new WebSocket(`${protocol}://${location.host}/ws`);await new Promise<void>((resolve,reject)=>{socket.onopen=()=>{socket.send(JSON.stringify({type:'message',to:other.id,body:value}));resolve();};socket.onerror=()=>reject(new Error('রিয়েল-টাইম সংযোগ পাওয়া যায়নি।'));});socket.close();setMessages(current=>[...current,{id:`local-${Date.now()}`,senderId:user.id,receiverId:other.id,body:value,createdAt:new Date().toISOString()}]);setBody('');}catch{try{const message=await post<any>(`/messages/${other.id}`,{body:value});setMessages(current=>[...current,message]);setBody('');}catch(e){setError(e instanceof Error?e.message:'বার্তা পাঠানো যায়নি।');}}};return <section className="page section"><p className="eyebrow">বার্তা</p><h1>শিক্ষক ও শিক্ষার্থীর কথোপকথন</h1><div className="chat"><aside><b>কথোপকথন</b>{items.length?items.map(item=><button className={`conversation ${other?.id===item.user.id?'active':''}`} key={item.user.id} onClick={()=>setOther(item.user)}><Avatar name={item.user.name} size="sm"/><span>{item.user.name}<small>{item.unreadCount?`${bn(item.unreadCount)}টি অপঠিত বার্তা`:item.lastMessage?.body||'কথোপকথন শুরু করুন'}</small></span></button>):<p className="help">কোনো কথোপকথন নেই। শিক্ষক প্রোফাইল থেকে বার্তা পাঠান।</p>}</aside><div className="chat-main">{loading?<Loading/>:error?<p className="form-error">{error}</p>:other?<><div className="chat-heading"><Avatar name={other.name} size="sm"/><b>{other.name}</b></div><div className="messages">{messages.map(m=><p className={m.senderId===user.id?'mine':''} key={m.id}>{m.body}<small>{new Date(m.createdAt).toLocaleTimeString('bn-BD',{hour:'2-digit',minute:'2-digit'})}</small></p>)}</div><form onSubmit={send}><input value={body} onChange={e=>setBody(e.target.value)} placeholder="বার্তা লিখুন" required/><button className="button">পাঠান</button></form></>:<Empty>একটি কথোপকথন নির্বাচন করুন।</Empty>}</div></div></section>}

export function Exams({user}:{user:User}){const [exams,setExams]=useState<Exam[]|null>(null);const [active,setActive]=useState<Exam|null>(null);const [answers,setAnswers]=useState<Record<string,number>>({});const [result,setResult]=useState<any>(null);useEffect(()=>{void api<Exam[]>('/exams').then(setExams);},[]);const open=async(id:string)=>{setResult(null);setAnswers({});setActive(await api<Exam>(`/exams/${id}`));};const submit=async()=>{if(!active)return;setResult(await post(`/exams/${active.id}/submit`,{answers}));};if(user.role!=='STUDENT')return <section className="page section"><Empty>পরীক্ষায় অংশ নিতে শিক্ষার্থী হিসেবে লগইন করুন।</Empty></section>;if(active)return <section className="page section exam"><p className="eyebrow">{active.subject} • {active.topic}</p><h1>{active.title}</h1><p className="help">সময়সীমা: {bn(active.duration)} মিনিট • পাস নম্বর: {bn(active.passMark)}%</p>{active.questions?.map((q,i)=><fieldset key={q.id}><legend>{bn(i+1)}. {q.text}</legend>{q.options.map((o,n)=><label key={o} className="option"><input type="radio" name={q.id} checked={answers[q.id]===n} onChange={()=>setAnswers({...answers,[q.id]:n})}/>{o}</label>)}</fieldset>)}{result?<div className="exam-result"><span>✓</span><h2>ফলাফল</h2><b>{bn(result.score)}/{bn(result.total)}</b><p>{result.passed?'অভিনন্দন! আপনি উত্তীর্ণ হয়েছেন।':'আরও অনুশীলন করে আবার চেষ্টা করুন।'}</p><button className="button" onClick={()=>setActive(null)}>পরীক্ষার তালিকায় ফিরুন</button></div>:<button className="button" onClick={()=>void submit()}>উত্তর জমা দিন</button>}</section>;return <section className="page section"><p className="eyebrow">MCQ অনুশীলন</p><h1>আমার পরীক্ষা</h1>{exams?<div className="exam-list">{exams.map(e=><article key={e.id}><span>{e.subject}</span><h2>{e.title}</h2><p>{bn(e.questions as unknown as number)}টি প্রশ্ন • {bn(e.duration)} মিনিট • পাস নম্বর {bn(e.passMark)}%</p><button className="button" onClick={()=>void open(e.id)}>পরীক্ষা শুরু করুন</button></article>)}</div>:<Loading/>}</section>}

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
    <div className="problem-market-hero">
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
          <div className="problem-live-person"><Avatar name={t.user.name} size="sm" teacherId={t.id}/><div><b>{t.user.name}</b><small>{t.subjects[0]} · {bn(t.experienceYears)} বছরের অভিজ্ঞতা</small></div><span className={'live-pill '+(t.isLive?'online':'offline')}>{t.isLive?'লাইভ':'অফলাইন'}</span></div>
          <p>{t.headline}</p><div className="problem-live-rating"><span>★ {t.rating.toFixed(1)} <small>({bn(t.reviewCount)} রিভিউ)</small></span><b>{money(t.sessionPrice??t.hourlyRate)}</b></div>
          <div className="problem-live-actions"><button className="quiet-btn" onClick={()=>go('/messages')}>চ্যাট</button><button className="button" onClick={()=>setBookingTeacher(t)}>সময় বেছে নিন</button></div>
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
function OfferForm({problemId,onClose,onDone}:{problemId:string;onClose:()=>void;onDone:()=>void}){const [f,setF]=useState({message:'আমি ধাপে ধাপে সমাধান বুঝিয়ে দেব।',price:'400'});const submit=async(e:React.FormEvent)=>{e.preventDefault();await post(`/problems/${problemId}/offers`,{...f,price:Number(f.price)});onDone();};return <div className="modal-back"><section className="modal"><button className="close" onClick={onClose}>×</button><h2>সমাধানের প্রস্তাব দিন</h2><form onSubmit={submit}><label>আপনার বার্তা<textarea value={f.message} onChange={e=>setF({...f,message:e.target.value})}/></label><label>ডেমো মূল্য<input type="number" value={f.price} onChange={e=>setF({...f,price:e.target.value})}/></label><button className="button wide">প্রস্তাব পাঠান</button></form></section></div>}
function OfferList({problem,onDone}:{problem:any;onDone:()=>void}){const accept=async(id:string)=>{await post(`/problems/${problem.id}/offers/${id}/accept`);onDone();};return <div className="offers"><b>{bn(problem.offers.length)}টি প্রস্তাব</b>{problem.offers.map((o:any)=><p key={o.id}>{o.message} <span>{money(o.price)}</span>{o.status==='PENDING'&&<button className="quiet-btn" onClick={()=>void accept(o.id)}>গ্রহণ করুন</button>}</p>)}</div>}

export function NotificationsPage(){const [items,setItems]=useState<Notification[]|null>(null);const mark=async(n:Notification)=>{await post(`/notifications/${n.id}/read`);setItems(items?.map(x=>x.id===n.id?{...x,readAt:new Date().toISOString()}:x)||null);go(n.href);};useEffect(()=>{void api<Notification[]>('/notifications').then(setItems);},[]);return <section className="page section"><p className="eyebrow">আপডেট</p><h1>নোটিফিকেশন</h1>{items?<div className="notification-page">{items.length?items.map(n=><button className={n.readAt?'read':''} onClick={()=>void mark(n)} key={n.id}><span>{n.type==='BOOKING'?'▣':'●'}</span><div><b>{n.title}</b><p>{n.body}</p><small>{shortDate(n.createdAt)}</small></div></button>):<Empty>নতুন কোনো নোটিফিকেশন নেই।</Empty>}</div>:<Loading/>}</section>}

export function Classroom({user}:{user:User}){const bookingId=location.hash.split('/')[2];const [booking,setBooking]=useState<Booking|null>(null);const [camera,setCamera]=useState(false);const [mic,setMic]=useState(true);const [tab,setTab]=useState<'board'|'chat'|'notes'>('board');const [chat,setChat]=useState<{name:string;text:string}[]>([]);const [message,setMessage]=useState('');const [notes,setNotes]=useState('');const [recording,setRecording]=useState<'idle'|'recording'|'paused'|'done'>('idle');const [recordUrl,setRecordUrl]=useState('');const [recordSeconds,setRecordSeconds]=useState(0);const stream=useRef<MediaStream|null>(null);const recorder=useRef<MediaRecorder|null>(null);const chunks=useRef<Blob[]>([]);const video=useRef<HTMLVideoElement>(null);useEffect(()=>{void api<Booking[]>('/bookings').then(x=>{const b=x.find(v=>v.id===bookingId)||null;setBooking(b);setNotes(b?.notes||'');});return()=>stream.current?.getTracks().forEach(t=>t.stop());},[bookingId]);useEffect(()=>{if(recording==='recording'){const timer=setInterval(()=>setRecordSeconds(s=>s+1),1000);return()=>clearInterval(timer);}},[recording]);const cameraToggle=async()=>{if(camera){stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(video.current)video.current.srcObject=null;setCamera(false);return;}try{stream.current=await navigator.mediaDevices.getUserMedia({video:true,audio:true});if(video.current)video.current.srcObject=stream.current;setCamera(true);}catch{alert('ক্যামেরা/মাইক্রোফোন অনুমতি পাওয়া যায়নি। ব্রাউজারের অনুমতি দিন।');}};const micToggle=()=>{stream.current?.getAudioTracks().forEach(t=>t.enabled=!t.enabled);setMic(!mic);};const toggleRecord=async()=>{if(recording==='idle'){try{if(!stream.current){stream.current=await navigator.mediaDevices.getUserMedia({video:true,audio:true});if(video.current)video.current.srcObject=stream.current;setCamera(true);}chunks.current=[];recorder.current=new MediaRecorder(stream.current);recorder.current.ondataavailable=e=>chunks.current.push(e.data);recorder.current.onstop=()=>{const url=URL.createObjectURL(new Blob(chunks.current,{type:'video/webm'}));setRecordUrl(url);setRecording('done');if(user.role==='TEACHER')void post(`/bookings/${bookingId}/recording`,{name:`ক্লাস রেকর্ডিং ${new Date().toLocaleDateString('bn-BD')}`,duration:recordSeconds});};recorder.current.start();setRecording('recording');}catch{alert('এই ব্রাউজারে লোকাল রেকর্ডিং চালু করা যায়নি।');}}else if(recording==='recording'){recorder.current?.pause();setRecording('paused');}else if(recording==='paused'){recorder.current?.resume();setRecording('recording');}};const stopRecord=()=>{if(['recording','paused'].includes(recording))recorder.current?.stop();};const saveNotes=async()=>{if(user.role!=='TEACHER')return;await post(`/bookings/${bookingId}/notes`,{notes});alert('ক্লাস নোট সংরক্ষিত হয়েছে।');};const end=async()=>{if(user.role==='TEACHER')await post(`/bookings/${bookingId}/status`,{status:'COMPLETED'});go('/bookings');};if(!booking)return <Loading/>;return <section className="classroom"><div className="class-top"><div><span className="live-dot">●</span> লোকাল ডেমো ক্লাসরুম <small>• {shortDate(booking.date)} {booking.time}</small></div><div><span>{String(Math.floor(recordSeconds/60)).padStart(2,'0')}:{String(recordSeconds%60).padStart(2,'0')}</span><button className="danger-btn" onClick={()=>void end()}>ক্লাস শেষ করুন</button></div></div><div className="class-grid"><div className="class-main"><div className="videos"><div className="video-tile"><video ref={video} autoPlay muted playsInline/><span>{camera?'আপনার ক্যামেরা':'ক্যামেরা বন্ধ'}</span></div><div className="video-tile alt"><Avatar name={user.role==='TEACHER'?'শিক্ষার্থী':'শিক্ষক'} size="lg"/><span>{user.role==='TEACHER'?'শিক্ষার্থী':'শিক্ষক'} (লোকাল অংশগ্রহণকারী)</span></div></div><div className="class-controls"><button onClick={()=>void cameraToggle()}>{camera?'ক্যামেরা বন্ধ':'ক্যামেরা চালু'}</button><button onClick={micToggle}>{mic?'মাইক বন্ধ':'মাইক চালু'}</button><button onClick={()=>alert('স্ক্রিন শেয়ার আপনার ব্রাউজারের নিরাপত্তানীতির কারণে এই লোকাল ডেমোতে উপলভ্য নয়।')}>স্ক্রিন শেয়ার</button><button onClick={()=>void toggleRecord()}>{recording==='idle'?'রেকর্ড শুরু':recording==='recording'?'বিরতি দিন':recording==='paused'?'চালিয়ে যান':'রেকর্ড সম্পন্ন'}</button>{['recording','paused'].includes(recording)&&<button onClick={stopRecord}>রেকর্ড থামান</button>}</div>{recordUrl&&<div className="recorded"><b>লোকাল রেকর্ডিং প্রস্তুত</b><video src={recordUrl} controls/><a className="quiet-btn" href={recordUrl} download="shikhok-class.webm">ভিডিও ডাউনলোড করুন</a></div>}<div className="workspace"><div className="tabs"><button className={tab==='board'?'active':''} onClick={()=>setTab('board')}>হোয়াইটবোর্ড</button><button className={tab==='chat'?'active':''} onClick={()=>setTab('chat')}>ক্লাস চ্যাট</button><button className={tab==='notes'?'active':''} onClick={()=>setTab('notes')}>ক্লাস নোট</button></div>{tab==='board'?<Whiteboard bookingId={bookingId}/>:tab==='chat'?<div className="class-chat"><div>{chat.length?chat.map((m,i)=><p key={i}><b>{m.name}: </b>{m.text}</p>):<Empty>এখনও কোনো বার্তা নেই।</Empty>}</div><form onSubmit={e=>{e.preventDefault();if(message.trim()){setChat([...chat,{name:user.name,text:message}]);setMessage('')}}}><input value={message} onChange={e=>setMessage(e.target.value)} placeholder="ক্লাসে বার্তা লিখুন"/><button className="button">পাঠান</button></form></div>:<div className="notes-editor">{user.role==='TEACHER'?<><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="আজ কী পড়ানো হয়েছে, সূত্র, বাড়ির কাজ ও পরবর্তী ক্লাসের প্রস্তুতি লিখুন"/><button className="button" onClick={()=>void saveNotes()}>নোট সংরক্ষণ করুন</button></>:<p>{notes||'শিক্ষক এখনও কোনো ক্লাস নোট যোগ করেননি।'}</p>}</div>}</div></div><aside className="participants"><h3>অংশগ্রহণকারী (২)</h3><p><Avatar name={user.name} size="sm"/>{user.name} (আপনি)</p><p><Avatar name={user.role==='TEACHER'?'শিক্ষার্থী':'শিক্ষক'} size="sm"/>{user.role==='TEACHER'?'শিক্ষার্থী':'শিক্ষক'}</p><hr/><h3>উপস্থিতি</h3><p className="help">লোকাল ক্লাসরুমে আপনার উপস্থিতি নিবন্ধিত হয়েছে।</p></aside></div></section>}
function Whiteboard({bookingId}:{bookingId:string}){const canvas=useRef<HTMLCanvasElement>(null);const [tool,setTool]=useState('pen');const [color,setColor]=useState('#164e63');const [size,setSize]=useState(4);const [,setHistory]=useState<string[]>([]);const [,setRedo]=useState<string[]>([]);const [pages,setPages]=useState<string[]>(['']);const [page,setPage]=useState(0);const draw=useRef(false);const start=useRef({x:0,y:0});const base=useRef('');const setup=()=>{const c=canvas.current;if(!c)return;const ctx=c.getContext('2d')!;if(!c.width){c.width=1000;c.height=560;ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);const saved=localStorage.getItem(`shikhok-board-${bookingId}`);if(saved){const img=new Image();img.onload=()=>ctx.drawImage(img,0,0);img.src=saved;}}};useEffect(()=>{setup();},[]);const point=(e:React.PointerEvent)=>{const r=canvas.current!.getBoundingClientRect();return{x:(e.clientX-r.left)*(canvas.current!.width/r.width),y:(e.clientY-r.top)*(canvas.current!.height/r.height)}};const restore=(url:string)=>{if(!url)return;const ctx=canvas.current!.getContext('2d')!;const img=new Image();img.onload=()=>{ctx.clearRect(0,0,canvas.current!.width,canvas.current!.height);ctx.drawImage(img,0,0);};img.src=url;};const save=()=>{const u=canvas.current!.toDataURL();setHistory(h=>[...h,u]);setRedo([]);localStorage.setItem(`shikhok-board-${bookingId}`,u);setPages(p=>p.map((x,i)=>i===page?u:x));};const down=(e:React.PointerEvent)=>{const c=canvas.current!;c.setPointerCapture(e.pointerId);const p=point(e);start.current=p;base.current=c.toDataURL();draw.current=true;const ctx=c.getContext('2d')!;ctx.strokeStyle=tool==='eraser'?'#ffffff':color;ctx.fillStyle=color;ctx.lineWidth=size;ctx.lineCap='round';if(tool==='text'){const value=window.prompt('বোর্ডে কী লিখবেন?');if(value){ctx.font=`${Math.max(18,size*5)}px sans-serif`;ctx.fillText(value,p.x,p.y);save();}draw.current=false;return;}if(['pen','eraser'].includes(tool)){ctx.beginPath();ctx.moveTo(p.x,p.y);}};const move=(e:React.PointerEvent)=>{if(!draw.current)return;const c=canvas.current!,ctx=c.getContext('2d')!,p=point(e);if(['pen','eraser'].includes(tool)){ctx.lineTo(p.x,p.y);ctx.stroke();return;}restore(base.current);ctx.strokeStyle=color;ctx.lineWidth=size;ctx.beginPath();if(tool==='line'){ctx.moveTo(start.current.x,start.current.y);ctx.lineTo(p.x,p.y);}if(tool==='rect')ctx.rect(start.current.x,start.current.y,p.x-start.current.x,p.y-start.current.y);if(tool==='circle'){const r=Math.hypot(p.x-start.current.x,p.y-start.current.y);ctx.arc(start.current.x,start.current.y,r,0,Math.PI*2);}ctx.stroke();};const up=()=>{if(draw.current){draw.current=false;save();}};const undo=()=>{setHistory(h=>{if(h.length<2)return h;const old=h[h.length-2];setRedo(r=>[h[h.length-1],...r]);restore(old);localStorage.setItem(`shikhok-board-${bookingId}`,old);return h.slice(0,-1);});};const redoDraw=()=>{setRedo(r=>{if(!r.length)return r;const next=r[0];restore(next);setHistory(h=>[...h,next]);return r.slice(1);});};const clear=()=>{const c=canvas.current!,ctx=c.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);save();};const nextPage=()=>{save();const c=canvas.current!,ctx=c.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);setPages([...pages,'']);setPage(pages.length);setHistory([]);};const switchPage=(index:number)=>{save();setPage(index);setTimeout(()=>restore(pages[index]),0);};return <div className="whiteboard"><div className="board-tools"><select value={tool} onChange={e=>setTool(e.target.value)}><option value="pen">কলম</option><option value="eraser">ইরেজার</option><option value="text">টেক্সট</option><option value="line">রেখা</option><option value="rect">আয়তক্ষেত্র</option><option value="circle">বৃত্ত</option></select><input type="color" aria-label="রঙ নির্বাচন" value={color} onChange={e=>setColor(e.target.value)}/><input type="range" aria-label="কলমের আকার" min="1" max="20" value={size} onChange={e=>setSize(Number(e.target.value))}/><button onClick={undo}>পূর্বাবস্থায়</button><button onClick={redoDraw}>পুনরায়</button><button onClick={clear}>মুছুন</button><button onClick={nextPage}>নতুন পাতা</button><button onClick={()=>{const u=canvas.current?.toDataURL()||'';localStorage.setItem(`shikhok-board-${bookingId}`,u);alert('হোয়াইটবোর্ড লোকাল ব্রাউজার স্টোরেজে সংরক্ষিত হয়েছে।')}}>সংরক্ষণ</button></div><canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} aria-label="ইন্টারঅ্যাক্টিভ হোয়াইটবোর্ড"/><div className="page-pills">{pages.map((_,i)=><button className={i===page?'active':''} key={i} onClick={()=>switchPage(i)}>পাতা {bn(i+1)}</button>)}</div></div>}
