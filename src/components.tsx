import { type ReactNode, useEffect, useRef, useState } from 'react';
import { post } from './api';
import type { Gig, Teacher, User } from './models';

export const money = (n:number) => `৳${new Intl.NumberFormat('bn-BD').format(n)}`;
export const bn = (n:number) => new Intl.NumberFormat('bn-BD').format(n);
export const shortDate = (v:string) => new Intl.DateTimeFormat('bn-BD',{dateStyle:'medium'}).format(new Date(v));
export const go = (to:string) => { location.hash=to; window.dispatchEvent(new HashChangeEvent('hashchange')); };
export function teacherPortrait(teacherId:string) { const featured:Record<string,string>={'teacher-11':'/images/featured-teachers/nabila-sultana.png','teacher-7':'/images/featured-teachers/tamanna-akter.png','teacher-10':'/images/featured-teachers/farhan-kabir.png','teacher-6':'/images/featured-teachers/rafi-hasan.png'};if(featured[teacherId])return featured[teacherId];const number=Number(teacherId.match(/(\d+)$/)?.[1]);const hash=Array.from(teacherId).reduce((sum,char)=>sum+char.charCodeAt(0),0);const imageIndex=number>0?((number-1)%20)+1:(hash%20)+1;return `/images/teachers/teacher-${String(imageIndex).padStart(2,'0')}.svg`; }
export const photoFromUser = (user?: Pick<User, 'profile'>) => typeof user?.profile?.photoUrl === 'string' ? user.profile.photoUrl : undefined;
export function Avatar({name,size='md',teacherId,photoUrl}:{name:string;size?:'sm'|'md'|'lg';teacherId?:string;photoUrl?:string}) { const src=photoUrl|| (teacherId?teacherPortrait(teacherId):undefined);return <span className={`avatar ${size}${src?' has-portrait':''}`} aria-hidden={src?true:undefined}>{src?<img src={src} alt="" loading="lazy" onError={event=>{event.currentTarget.hidden=true;}}/>:name.trim().slice(0,1)}</span>; }

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
        <button className="user-pill" onClick={()=>{closeMenu();go(dashboard);}}><Avatar name={user.name} size="sm" photoUrl={photoFromUser(user)}/><span>{user.name}</span></button>
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
    <footer><div className="brand footer-brand"><img src="/images/private-tutor-logo.png" alt="" /><span className="footer-wordmark"><span className="footer-private">Private</span> <b>Tutor</b><i aria-hidden="true"></i></span></div><p>Founded by Tanvir Alam Prince</p></footer>
  </>;
}
type MobileNavIconName = 'home' | 'search' | 'booking' | 'message' | 'exam' | 'profile' | 'logout' | 'users' | 'report';
function MobileNavIcon({name}:{name:MobileNavIconName}) {
  const common={viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,focusable:false,'aria-hidden':true as const};
  if(name==='home')return <svg {...common}><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></svg>;
  if(name==='search')return <svg {...common}><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>;
  if(name==='booking')return <svg {...common}><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M4 9.5h16M8 13h3M8 16.5h6"/></svg>;
  if(name==='message')return <svg {...common}><path d="M20 11.3a7.3 7.3 0 0 1-7.3 7.3H7l-3.5 2v-5A7.3 7.3 0 1 1 20 11.3Z"/><path d="M8 10h8M8 13.5h5"/></svg>;
  if(name==='exam')return <svg {...common}><rect x="5" y="4.5" width="14" height="17" rx="2"/><path d="M9 4.5a3 3 0 0 1 6 0v2H9zM9 12h6M9 16h6"/></svg>;
  if(name==='profile')return <svg {...common}><circle cx="12" cy="8" r="3.5"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg>;
  if(name==='logout')return <svg {...common}><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 4h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/></svg>;
  if(name==='users')return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17 14a5.2 5.2 0 0 1 3.5 5"/></svg>;
  return <svg {...common}><path d="M4 20h16M6 16v-5M11 16V7M16 16V4M20 16V9"/></svg>;
}

function MobileNav({user,onLogout}:{user:User;onLogout:()=>void}) {
  const isAdmin=['ADMIN','SUPER_ADMIN'].includes(user.role);
  const items:Array<{icon:MobileNavIconName;label:string;href:string}>=user.role==='TEACHER'
    ?[{icon:'home',label:'ড্যাশবোর্ড',href:'/dashboard'},{icon:'booking',label:'বুকিং',href:'/bookings'},{icon:'message',label:'বার্তা',href:'/messages'},{icon:'exam',label:'পরীক্ষা',href:'/teacher/exams'},{icon:'profile',label:'প্রোফাইল',href:'/profile'}]
    :isAdmin
      ?[{icon:'home',label:'ড্যাশবোর্ড',href:'/dashboard'},{icon:'users',label:'ব্যবহারকারী',href:'/admin/users'},{icon:'booking',label:'বুকিং',href:'/bookings'},{icon:'report',label:'রিপোর্ট',href:'/admin/reports'}]
      :[{icon:'home',label:'হোম',href:'/'},{icon:'search',label:'খুঁজুন',href:'/search'},{icon:'booking',label:'বুকিং',href:'/bookings'},{icon:'message',label:'বার্তা',href:'/messages'},{icon:'profile',label:'প্রোফাইল',href:'/dashboard'}];
  const currentPath=location.hash.slice(1).split('?')[0]||'/';
  const active=(href:string)=>currentPath===href||currentPath.startsWith(`${href}/`)||(user.role!=='TEACHER'&&href==='/profile'&&currentPath==='/dashboard');
  return <nav className={`mobile-nav${isAdmin?' is-admin':''}`} aria-label="মোবাইল নেভিগেশন">
    {items.map(item=><a className="mobile-nav-item" href={`#${item.href}`} key={item.label} aria-current={active(item.href)?'page':undefined}>
      <span className="mobile-nav-icon"><MobileNavIcon name={item.icon}/></span><small>{item.label}</small>
    </a>)}
    <button className="mobile-nav-item mobile-logout" onClick={onLogout} aria-label="লগআউট">
      <span className="mobile-nav-icon"><MobileNavIcon name="logout"/></span><small>লগআউট</small>
    </button>
  </nav>;
}

export function TeacherCard({teacher,user,compare,onCompare}:{teacher:Teacher;user:User|null;compare:boolean;onCompare:(t:Teacher)=>void}) { void user; const [saved,setSaved]=useState(false); const favorite=async()=>{try{const r=await post<{saved:boolean}>('/favorites',{kind:'TEACHER',itemId:teacher.id});setSaved(r.saved);}catch{go('/login');}};return <article className="teacher-card"><div className="card-top"><Avatar name={teacher.user.name} size="lg" teacherId={teacher.id} photoUrl={photoFromUser(teacher.user)}/><div className="grow"><h3>{teacher.user.name}{teacher.verified&&<em className="verified">✓ যাচাইকৃত</em>}</h3><p>{teacher.headline}</p><div className="stars">★ {teacher.rating.toFixed(1)} <small>({bn(teacher.reviewCount)} রিভিউ)</small></div></div><button className="save-btn" onClick={favorite} aria-label="সংরক্ষণ করুন">{saved?'♥':'♡'}</button></div><div className="chips">{teacher.subjects.slice(0,2).map(s=><span key={s}>{s}</span>)}<span>{teacher.experienceYears} বছরের অভিজ্ঞতা</span></div><div className="card-meta"><span>{money(teacher.hourlyRate)} / ঘণ্টা</span><span>{teacher.languages.join(', ')}</span></div><div className="card-actions"><button className="quiet-btn" onClick={()=>onCompare(teacher)}>{compare?'তুলনায় আছে':'তুলনা করুন'}</button><button className="button" onClick={()=>go(`/teacher/${teacher.id}`)}>প্রোফাইল দেখুন</button></div></article> }

export function BookingModal({gig,onClose,onDone,initialPackageId}:{gig:Gig;onClose:()=>void;onDone:(bookingId:string)=>void;initialPackageId?:string}) { const [pack,setPack]=useState(initialPackageId||gig.packages[0]?.id||'');const [date,setDate]=useState(new Date(Date.now()+86400000).toISOString().slice(0,10));const [time,setTime]=useState('১৬:০০');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const chosen=gig.packages.find(p=>p.id===pack);const book=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{const b=await post<{id:string}>('/bookings',{gigId:gig.id,packageId:pack,date,time});onDone(b.id);}catch(e){setError(e instanceof Error?e.message:'সমস্যা হয়েছে');}finally{setBusy(false);}};return <div className="modal-back"><section className="modal" role="dialog" aria-modal="true" aria-label="ক্লাস বুক করুন"><button className="close" onClick={onClose} aria-label="বন্ধ করুন">×</button><p className="eyebrow">বুকিং নিশ্চিত করুন</p><h2>{gig.title}</h2><form onSubmit={book}><label>প্যাকেজ<select value={pack} onChange={e=>setPack(e.target.value)}>{gig.packages.map(p=><option value={p.id} key={p.id}>{p.name} — {p.classes}টি ক্লাস, {money(p.price)}</option>)}</select></label><div className="two"><label>তারিখ<input type="date" value={date} min={new Date().toISOString().slice(0,10)} onChange={e=>setDate(e.target.value)} required/></label><label>সময়<select value={time} onChange={e=>setTime(e.target.value)}><option>১০:০০</option><option>১৪:০০</option><option>১৬:০০</option><option>১৮:০০</option><option>২০:০০</option></select></label></div><div className="price-line"><span>মোট মূল্য</span><b>{money(chosen?.price||0)}</b></div>{error&&<p className="form-error">{error}</p>}<button className="button wide" disabled={busy}>{busy?'বুকিং তৈরি হচ্ছে…':'বুকিং নিশ্চিত করতে এগিয়ে যান'}</button><p className="help">এই পরিবেশে বুকিংয়ের জন্য বাস্তব অর্থ লেনদেন হয় না।</p></form></section></div> }

export function Empty({children}:{children:ReactNode}) { return <div className="empty"><span>◌</span><p>{children}</p></div> }
export function Loading(){return <div className="loading"><i></i>তথ্য লোড হচ্ছে…</div>}
