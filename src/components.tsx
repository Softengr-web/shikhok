import { type ReactNode, useEffect, useRef, useState } from 'react';
import { post } from './api';
import type { Gig, Teacher, User } from './models';

export const money = (n:number) => `৳${new Intl.NumberFormat('bn-BD').format(n)}`;
export const bn = (n:number) => new Intl.NumberFormat('bn-BD').format(n);
export const shortDate = (v:string) => new Intl.DateTimeFormat('bn-BD',{dateStyle:'medium'}).format(new Date(v));
export const go = (to:string) => { location.hash=to; window.dispatchEvent(new HashChangeEvent('hashchange')); };
export function teacherPortrait(teacherId:string) { const featured:Record<string,string>={'teacher-11':'/images/featured-teachers/nabila-sultana.png','teacher-7':'/images/featured-teachers/tamanna-akter.png','teacher-10':'/images/featured-teachers/farhan-kabir.png','teacher-6':'/images/featured-teachers/rafi-hasan.png'};if(featured[teacherId])return featured[teacherId];const number=Number(teacherId.match(/(\d+)$/)?.[1]);const hash=Array.from(teacherId).reduce((sum,char)=>sum+char.charCodeAt(0),0);const imageIndex=number>0?((number-1)%20)+1:(hash%20)+1;return `/images/teachers/teacher-${String(imageIndex).padStart(2,'0')}.svg`; }
export function Avatar({name,size='md',teacherId}:{name:string;size?:'sm'|'md'|'lg';teacherId?:string}) { return <span className={`avatar ${size}${teacherId?' has-portrait':''}`} aria-hidden={teacherId?true:undefined}>{teacherId?<img src={teacherPortrait(teacherId)} alt="" loading="lazy"/>:name.trim().slice(0,1)}</span>; }

export function Toast({message,onClose}:{message:string;onClose:()=>void}) { return <div className="toast" role="status"><span>{message}</span><button aria-label="বার্তাটি বন্ধ করুন" onClick={onClose}>×</button></div>; }
export function Shell({user,children,onLogout}:{user:User|null;children:ReactNode;onLogout:()=>void}) {
  const [open,setOpen]=useState(false);
  const menuButton=useRef<HTMLButtonElement>(null);
  const dashboard=user?'/dashboard':'/login';
  const currentPath=location.hash.slice(1).split('?')[0]||'/';
  const closeMenu=()=>setOpen(false);

  useEffect(()=>{
    if(!open)return;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){
        closeMenu();
        menuButton.current?.focus();
      }
    };
    const onHashChange=()=>closeMenu();
    window.addEventListener('keydown',onKeyDown);
    window.addEventListener('hashchange',onHashChange);
    return()=>{
      document.body.style.overflow=previousOverflow;
      window.removeEventListener('keydown',onKeyDown);
      window.removeEventListener('hashchange',onHashChange);
    };
  },[open]);

  useEffect(()=>{
    const desktop=window.matchMedia('(min-width: 901px)');
    const onDesktop=()=>setOpen(false);
    desktop.addEventListener('change',onDesktop);
    return()=>desktop.removeEventListener('change',onDesktop);
  },[]);

  const isAdmin=user&&['ADMIN','SUPER_ADMIN'].includes(user.role);
  const links=isAdmin?[
    ['/dashboard','অ্যাডমিন ড্যাশবোর্ড'],
    ['/admin/users','ব্যবহারকারী'],
    ['/admin/reports','রিপোর্ট'],
    ['/bookings','বুকিং'],
    ['/gigs','গিগ']
  ]:[
    ['/search','শিক্ষক খুঁজুন'],
    ['/gigs','জনপ্রিয় গিগ'],
    ['/problems','সমস্যা সমাধান'],
    ...(user?[['/exams','পরীক্ষা']]:[])
  ];

  return <>
    <header className="topbar">
      <a className="brand" href="#/" aria-label="Private Tutor হোম" onClick={closeMenu}><img src="/images/private-tutor-logo.png" alt="" /></a>
      <nav id="primary-navigation" className={open?'open':''} aria-label="প্রধান নেভিগেশন">
        {links.map(([href,label])=><a href={`#${href}`} key={href} aria-current={currentPath===href?'page':undefined} onClick={closeMenu}>{label}</a>)}
      </nav>
      <div className="head-actions">{user?<>
        <button className="icon-btn" aria-label="নোটিফিকেশন" onClick={()=>{closeMenu();go('/notifications');}}>🔔</button>
        <button className="user-pill" onClick={()=>{closeMenu();go(dashboard);}}><Avatar name={user.name} size="sm"/><span>{user.name}</span></button>
        <button className="quiet-btn logout" onClick={()=>{closeMenu();onLogout();}}>লগআউট</button>
      </>:<>
        <a className="quiet-btn" href="#/login" onClick={closeMenu}>লগইন</a>
        <a className="button small" href="#/register" onClick={closeMenu}>নিবন্ধন</a>
      </>}</div>
      <button ref={menuButton} className="menu-btn" type="button" aria-controls="primary-navigation" aria-expanded={open} aria-label={open?'মেনু বন্ধ করুন':'মেনু খুলুন'} onClick={()=>setOpen(value=>!value)}>
        <span className={open?'menu-icon is-open':'menu-icon'} aria-hidden="true"><i></i><i></i><i></i></span>
      </button>
    </header>
    {open&&<button className="menu-backdrop" type="button" aria-label="মেনু বন্ধ করুন" onClick={closeMenu}/>}
    <main>{children}</main>
    {user&&<MobileNav user={user} onLogout={onLogout}/>}
    <footer><div className="brand footer-brand"><img src="/images/private-tutor-logo.png" alt="" /><span className="footer-wordmark"><span className="footer-private">Private</span> <b>Tutor</b><i aria-hidden="true"></i></span></div><p>Created By Tanvir Alam Prince</p></footer>
  </>;
}
function MobileNav({user,onLogout}:{user:User;onLogout:()=>void}) { const isAdmin=['ADMIN','SUPER_ADMIN'].includes(user.role);const items=user.role==='TEACHER'?[['⌂','ড্যাশবোর্ড','/dashboard'],['▣','বুকিং','/bookings'],['♙','শিক্ষার্থী','/messages'],['✎','পরীক্ষা','/teacher/exams'],['◉','প্রোফাইল','/profile']]:isAdmin?[['⌂','ড্যাশবোর্ড','/dashboard'],['♙','ব্যবহারকারী','/admin/users'],['▣','বুকিং','/bookings'],['⚑','রিপোর্ট','/admin/reports']]:[['⌂','হোম','/'],['⌕','খুঁজুন','/search'],['▣','বুকিং','/bookings'],['✉','বার্তা','/messages'],['◉','প্রোফাইল','/dashboard']];return <nav className={`mobile-nav${isAdmin?' is-admin':''}`}>{items.map(([icon,label,href])=><a href={`#${href}`} key={label}><b>{icon}</b><small>{label}</small></a>)}<button className="mobile-logout" onClick={onLogout} aria-label="লগআউট"><b>↪</b><small>লগআউট</small></button></nav>}

export function TeacherCard({teacher,user,compare,onCompare}:{teacher:Teacher;user:User|null;compare:boolean;onCompare:(t:Teacher)=>void}) { void user; const [saved,setSaved]=useState(false); const favorite=async()=>{try{const r=await post<{saved:boolean}>('/favorites',{kind:'TEACHER',itemId:teacher.id});setSaved(r.saved);}catch{go('/login');}};return <article className="teacher-card"><div className="card-top"><Avatar name={teacher.user.name} size="lg" teacherId={teacher.id}/><div className="grow"><h3>{teacher.user.name}{teacher.verified&&<em className="verified">✓ যাচাইকৃত</em>}</h3><p>{teacher.headline}</p><div className="stars">★ {teacher.rating.toFixed(1)} <small>({bn(teacher.reviewCount)} রিভিউ)</small></div></div><button className="save-btn" onClick={favorite} aria-label="সংরক্ষণ করুন">{saved?'♥':'♡'}</button></div><div className="chips">{teacher.subjects.slice(0,2).map(s=><span key={s}>{s}</span>)}<span>{teacher.experienceYears} বছরের অভিজ্ঞতা</span></div><div className="card-meta"><span>{money(teacher.hourlyRate)} / ঘণ্টা</span><span>{teacher.languages.join(', ')}</span></div><div className="card-actions"><button className="quiet-btn" onClick={()=>onCompare(teacher)}>{compare?'তুলনায় আছে':'তুলনা করুন'}</button><button className="button" onClick={()=>go(`/teacher/${teacher.id}`)}>প্রোফাইল দেখুন</button></div></article> }

export function BookingModal({gig,onClose,onDone}:{gig:Gig;onClose:()=>void;onDone:(bookingId:string)=>void}) { const [pack,setPack]=useState(gig.packages[0]?.id||'');const [date,setDate]=useState(new Date(Date.now()+86400000).toISOString().slice(0,10));const [time,setTime]=useState('১৬:০০');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const chosen=gig.packages.find(p=>p.id===pack);const book=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{const b=await post<{id:string}>('/bookings',{gigId:gig.id,packageId:pack,date,time});onDone(b.id);}catch(e){setError(e instanceof Error?e.message:'সমস্যা হয়েছে');}finally{setBusy(false);}};return <div className="modal-back"><section className="modal" role="dialog" aria-modal="true" aria-label="ক্লাস বুক করুন"><button className="close" onClick={onClose} aria-label="বন্ধ করুন">×</button><p className="eyebrow">বুকিং নিশ্চিত করুন</p><h2>{gig.title}</h2><form onSubmit={book}><label>প্যাকেজ<select value={pack} onChange={e=>setPack(e.target.value)}>{gig.packages.map(p=><option value={p.id} key={p.id}>{p.name} — {p.classes}টি ক্লাস, {money(p.price)}</option>)}</select></label><div className="two"><label>তারিখ<input type="date" value={date} min={new Date().toISOString().slice(0,10)} onChange={e=>setDate(e.target.value)} required/></label><label>সময়<select value={time} onChange={e=>setTime(e.target.value)}><option>১০:০০</option><option>১৪:০০</option><option>১৬:০০</option><option>১৮:০০</option><option>২০:০০</option></select></label></div><div className="price-line"><span>মোট মূল্য</span><b>{money(chosen?.price||0)}</b></div>{error&&<p className="form-error">{error}</p>}<button className="button wide" disabled={busy}>{busy?'বুকিং তৈরি হচ্ছে…':'বুকিং নিশ্চিত করতে এগিয়ে যান'}</button><p className="help">এই পরিবেশে বুকিংয়ের জন্য বাস্তব অর্থ লেনদেন হয় না।</p></form></section></div> }

export function Empty({children}:{children:ReactNode}) { return <div className="empty"><span>◌</span><p>{children}</p></div> }
export function Loading(){return <div className="loading"><i></i>তথ্য লোড হচ্ছে…</div>}
