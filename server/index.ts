import express, { type Request, type Response, type NextFunction } from 'express';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHmac, randomUUID } from 'node:crypto';
import { store } from './store.js';
import { DomainError, authenticate, changeBookingStatus, cleanText, conversation, createBooking, createExam, createGig, createProblemSession, createReview, deleteExam, duplicateExam, findTeachers, getExamForStudent, listConversations, listTeacherExams, markConversationRead, matchTeachers, payBooking, privateUser, publicTeacher, publicUser, publishExam, register, requireRole, requireUser, sendMessage, setExamStatus, submitExam, teacherExamResults, updateExam, updateTeacher, updateUserProfile, wallet } from './services.js';
import { id, passwordHash, verifyPassword } from './seed.js';
import type { BookingStatus, ClassroomBoard, Role, User } from './types.js';
import { getGigDraft, publishGigDraft, saveGigDraft } from './gig-builder.js';
import { acceptCustomOffer, createCustomOffer, duplicateGig, editGig, moderateGig, recordGigView } from './gig-capabilities.js';
import { WebSocket, WebSocketServer } from 'ws';
import { abandonMcqAttempt, adminMcqIssues, adminMcqQuestions, adminMcqSources, adminMcqSummary, autoSubmitExpiredMcqAttempts, finalizeMcqImport, getActiveMcqAttempt, getMcqAttempt, importFailure, listMcqBookmarks, listMcqHistory, mcqCatalog, mcqDatabase, mcqMedia, mcqProfile, persistMcqBootstrapAdmin, persistMcqUser, resolveMcqIssue, setMcqQuestionStatus, startMcqAttempt, submitMcqAttempt, toggleMcqBookmark, updateMcqAnswer, uploadMcqBatch } from './mcq-service.js';

const app = express();
const sessions = new Map<string, string>();
const port = Number(process.env.PORT || 3001);
app.disable('x-powered-by');
app.use((_req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','SAMEORIGIN');res.setHeader('Referrer-Policy','same-origin');next();});
app.use(express.json({ limit: '20mb' }));

const cookie = (req: Request, name: string) => req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith(`${name}=`))?.slice(name.length+1);
const setSession = (res: Response, userId: string) => { const token=randomUUID();sessions.set(token,userId);res.setHeader('Set-Cookie',`shikhok_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${process.env.NODE_ENV==='production'?'; Secure':''}`); };
const currentUser = (req: Request) => { const token=cookie(req,'shikhok_session');const userId=token&&sessions.get(token);return userId?store.read().users.find(u=>u.id===userId):undefined; };
const auth = (roles?: Role[]) => (req:Request,_res:Response,next:NextFunction) => { try { const user=currentUser(req);if(!user)throw new DomainError('এই পেজটি দেখতে আগে লগইন করুন।',401);if(roles)requireRole(user,roles);(req as Request & { user:User }).user=user;next();}catch(e){next(e);} };
const handler = (fn:(req:Request,res:Response)=>unknown) => (req:Request,res:Response,next:NextFunction) => { try { void Promise.resolve(fn(req,res)).catch(next); } catch (e) { next(e); } };
const actor = (req: Request) => (req as Request & { user: User }).user;
const ok = (res:Response,data:unknown,status=200) => res.status(status).json({ ok:true,data });

app.get('/api/health', handler(async(_req,res)=>{
  if(process.env.NODE_ENV==='production'&&!process.env.DATABASE_URL)throw new DomainError('Production database সংযুক্ত নেই।',503);
  if(process.env.DATABASE_URL)await mcqDatabase().$queryRaw`SELECT 1`;
  return ok(res,{status:'শিখোক সার্ভার সচল',mode:process.env.DATABASE_URL?'postgres':'local-demo'});
}));
app.post('/api/auth/login', handler(async(req,res)=> {
  const email=String(req.body.email||'').trim().toLowerCase();
  const isPublicStudentDemo=process.env.NODE_ENV==='production'&&email==='student@demo.local'&&String(req.body.password||'')==='demo123';
  if(process.env.NODE_ENV==='production'&&email.endsWith('@demo.local')&&!isPublicStudentDemo)throw new DomainError('ইমেইল বা পাসওয়ার্ড সঠিক নয়।',401);
  let state=store.read();
  let account=state.users.find(user=>user.email===email&&user.active);
  let demoAccountVerifiedFromDatabase=false;
  if(isPublicStudentDemo&&process.env.DATABASE_URL){
    const saved=await mcqDatabase().user.findUnique({where:{email}});
    if(saved){
      if(saved.deletedAt||saved.role!=='STUDENT'||!verifyPassword(String(req.body.password||''),saved.passwordHash))throw new DomainError('ইমেইল বা পাসওয়ার্ড সঠিক নয়।',401);
      account={id:saved.id,email:saved.email,role:'STUDENT',name:saved.name,passwordHash:saved.passwordHash,phone:saved.phone||undefined,createdAt:saved.createdAt.toISOString(),active:true,profile:{}};
      store.transaction(draft=>{const existing=draft.users.findIndex(user=>user.email===email);if(existing>=0)draft.users[existing]=account!;else draft.users.push(account!);});
      state=store.read();account=state.users.find(user=>user.id===saved.id)!;demoAccountVerifiedFromDatabase=true;
    }
  }
  if(account){if(!demoAccountVerifiedFromDatabase)authenticate(state,email,req.body.password);}
  else if(process.env.DATABASE_URL){
    const saved=await mcqDatabase().user.findUnique({where:{email}});
    const bootstrapAdmin=email===(process.env.BOOTSTRAP_ADMIN_EMAIL||'').trim().toLowerCase();
    const allowedRole=saved&&(['STUDENT','TEACHER','PARENT'].includes(saved.role)||(bootstrapAdmin&&saved.role==='ADMIN'));
    if(!saved||saved.deletedAt||!allowedRole||!verifyPassword(String(req.body.password||''),saved.passwordHash))throw new DomainError('ইমেইল বা পাসওয়ার্ড সঠিক নয়।',401);
    account={id:saved.id,email:saved.email,role:saved.role,name:saved.name,passwordHash:saved.passwordHash,phone:saved.phone||undefined,createdAt:saved.createdAt.toISOString(),active:true,profile:{}};
    store.transaction(draft=>{if(!draft.users.some(user=>user.id===account!.id))draft.users.push(account!);});
    state=store.read();account=state.users.find(user=>user.id===saved.id)!;
  }else authenticate(state,email,req.body.password);
  await persistMcqUser(account!);
  setSession(res,account!.id);
  return ok(res,publicUser(account!));
}));
app.post('/api/auth/register', handler(async(req,res)=> {
  if(process.env.DATABASE_URL){const email=String(req.body.email||'').trim().toLowerCase();if(await mcqDatabase().user.findUnique({where:{email},select:{id:true}}))throw new DomainError('এই ইমেইল দিয়ে ইতোমধ্যে নিবন্ধন করা আছে।',409);}
  const user=store.transaction(s=>register(s,req.body));
  const account=store.read().users.find(item=>item.id===user.id)!;
  await persistMcqUser(account);
  setSession(res,user.id);
  return ok(res,user,201);
}));
app.post('/api/auth/logout', handler((req,res)=> { const token=cookie(req,'shikhok_session');if(token)sessions.delete(token);res.setHeader('Set-Cookie','shikhok_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');return ok(res,{message:'আপনি সফলভাবে লগআউট করেছেন।'}); }));
app.get('/api/auth/me', handler((req,res)=> { const user=currentUser(req);if(!user)throw new DomainError('লগইন সেশন নেই।',401);return ok(res,publicUser(user)); }));

app.get('/api/subjects', handler((_req,res)=>ok(res,store.read().subjects)));
app.get('/api/teachers', handler((req,res)=>ok(res,findTeachers(store.read(),req.query))));
app.get('/api/matches', handler((req,res)=>ok(res,matchTeachers(store.read(),req.query))));
app.get('/api/teachers/:id', handler((req,res)=> { const state=store.read();const teacher=state.teachers.find(t=>t.id===req.params.id);if(!teacher)throw new DomainError('শিক্ষক পাওয়া যায়নি।',404);return ok(res,{...publicTeacher(state,teacher),reviews:state.reviews.filter(r=>r.teacherId===teacher.id).slice(-12)}); }));
app.get('/api/gigs', handler((req,res)=>ok(res,store.transaction(state=> { let gigs=state.gigs.filter(g=>g.active&&g.moderationStatus!=='REJECTED');const q=String(req.query.q||'').toLowerCase();const min=Number(req.query.minPrice||0);const max=Number(req.query.maxPrice||0);const duration=Number(req.query.duration||0);if(req.query.subject)gigs=gigs.filter(g=>g.subject===String(req.query.subject));if(req.query.level)gigs=gigs.filter(g=>(g.levels||g.level.split(', ')).includes(String(req.query.level))||g.level.includes(String(req.query.level)));if(q)gigs=gigs.filter(g=>`${g.title} ${g.description} ${g.topic} ${g.tags.join(' ')}`.toLowerCase().includes(q));if(min)gigs=gigs.filter(g=>g.packages.some(p=>p.price>=min));if(max)gigs=gigs.filter(g=>g.packages.some(p=>p.price<=max));if(duration)gigs=gigs.filter(g=>(g.duration||g.packages[0]?.duration||0)<=duration);if(req.query.language)gigs=gigs.filter(g=>g.language===String(req.query.language));if(req.query.trial==='true')gigs=gigs.filter(g=>g.trial?.enabled);if(req.query.tag)gigs=gigs.filter(g=>g.tags.includes(String(req.query.tag)));gigs.forEach(g=>recordGigView(state,g.id));return gigs.map(g=>({...g,teacher:publicTeacher(state,state.teachers.find(t=>t.id===g.teacherId)!)})); }))));
app.get('/api/gigs/:id', handler((req,res)=>ok(res,store.transaction(state=> { const gig=state.gigs.find(g=>g.id===req.params.id&&g.active);if(!gig)throw new DomainError('গিগটি পাওয়া যায়নি।',404);recordGigView(state,gig.id);return {...gig,teacher:publicTeacher(state,state.teachers.find(t=>t.id===gig.teacherId)!),reviews:state.reviews.filter(r=>r.teacherId===gig.teacherId).slice(-10),analytics:state.gigAnalytics?.find(a=>a.gigId===gig.id),versions:state.gigVersions?.filter(v=>v.gigId===gig.id)}; }))));

app.get('/api/dashboard', auth(), handler((req,res)=> { const state=store.read(), user=actor(req);const bookings=state.bookings.filter(b=>b.studentId===user.id||b.teacherId===user.id); const payload:any={user:privateUser(user),bookings,notifications:state.notifications.filter(n=>n.userId===user.id).slice(-8).reverse(),unread:state.notifications.filter(n=>n.userId===user.id&&!n.readAt).length}; if(user.role==='TEACHER'){const t=state.teachers.find(x=>x.userId===user.id);payload.teacher=t;payload.wallet=wallet(state,user);payload.gigs=state.gigs.filter(g=>g.teacherId===user.id);payload.analytics={profileViews:t?.profileViews||0,gigViews:t?.gigViews||0,bookings:bookings.length,completed:bookings.filter(b=>b.status==='COMPLETED').length,rating:t?.rating||0};}if(user.role==='STUDENT'){payload.favorites=state.favorites.filter(f=>f.userId===user.id);payload.attempts=state.attempts.filter(a=>a.studentId===user.id);}if(user.role==='PARENT'){const children=state.parentChildren.filter(p=>p.parentId===user.id).map(p=>requireUser(state,p.childId));payload.children=children.map(c=>({...publicUser(c),bookings:state.bookings.filter(b=>b.studentId===c.id),attempts:state.attempts.filter(a=>a.studentId===c.id)}));}if(['ADMIN','SUPER_ADMIN'].includes(user.role))payload.admin={users:state.users.length,teachers:state.teachers.length,pending:state.teachers.filter(t=>t.verificationStatus==='PENDING').length,payments:state.payments.length,reports:state.reports.filter(r=>r.status==='OPEN').length};return ok(res,payload); }));

app.put('/api/profile',auth(['STUDENT','TEACHER']),handler(async(req,res)=>{const result=store.transaction(state=>{const current=state.users.find(user=>user.id===actor(req).id)!;const user=updateUserProfile(state,current,req.body);const teacherInput=req.body.teacher;const teacher=current.role==='TEACHER'&&teacherInput&&typeof teacherInput==='object'&&!Array.isArray(teacherInput)?updateTeacher(state,user,teacherInput as Record<string,unknown>):undefined;return {user:publicUser(user),teacher};});const account=store.read().users.find(user=>user.id===actor(req).id);if(account)await persistMcqUser(account);return ok(res,result);}));
app.get('/api/bookings', auth(), handler((req,res)=> { const user=actor(req);const data=store.read().bookings.filter(b=>user.role==='ADMIN'||b.studentId===user.id||b.teacherId===user.id);return ok(res,data); }));
app.get('/api/classroom/:bookingId/ice-servers',auth(),handler(async(req,res)=>{
  const user=actor(req);const booking=store.read().bookings.find(item=>item.id===req.params.bookingId);
  if(!booking||![booking.studentId,booking.teacherId].includes(user.id)||!['CONFIRMED','IN_PROGRESS'].includes(booking.status))throw new DomainError('এই ক্লাসের ICE configuration পাওয়ার অনুমতি নেই।',403);
  const iceServers:Array<{urls:string|string[];username?:string;credential?:string;credentialType?:'password'}>=[
    {urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}
  ];
  const meteredApp=process.env.METERED_APP_NAME?.trim();const meteredKey=process.env.METERED_API_KEY?.trim();
  if(meteredApp&&meteredKey&&/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(meteredApp)){
    try{
      const response=await fetch(`https://${meteredApp}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(meteredKey)}`,{headers:{accept:'application/json'},signal:AbortSignal.timeout(5000)});
      if(response.ok){
        const payload:unknown=await response.json();
        if(Array.isArray(payload))for(const item of payload){
          if(!item||typeof item!=='object')continue;
          const server=item as {urls?:unknown;username?:unknown;credential?:unknown};
          const urls=(Array.isArray(server.urls)?server.urls:[server.urls]).filter((url):url is string=>typeof url==='string'&&/^turns?:/i.test(url));
          if(urls.length&&typeof server.username==='string'&&typeof server.credential==='string')iceServers.push({urls,username:server.username,credential:server.credential,credentialType:'password'});
        }
      }
    }catch{/* Fall through to an explicitly configured coturn server or STUN-only mode. */}
  }
  const turnUrls=(process.env.TURN_URLS||'').split(',').map(url=>url.trim()).filter(url=>/^turns?:/i.test(url));
  const turnSecret=process.env.TURN_SHARED_SECRET;
  if(turnUrls.length&&turnSecret){
    const username=`${Math.floor(Date.now()/1000)+8*60*60}:${user.id}`;
    const credential=createHmac('sha1',turnSecret).update(username).digest('base64');
    iceServers.push({urls:turnUrls,username,credential,credentialType:'password'});
  }else if(turnUrls.length&&process.env.TURN_USERNAME&&process.env.TURN_CREDENTIAL){
    iceServers.push({urls:turnUrls,username:process.env.TURN_USERNAME,credential:process.env.TURN_CREDENTIAL,credentialType:'password'});
  }
  return ok(res,{iceServers,turnAvailable:iceServers.length>1});
}));
app.post('/api/bookings',auth(['STUDENT']),handler((req,res)=>ok(res,store.transaction(s=>createBooking(s,actor(req),req.body)),201)));
app.post('/api/bookings/:id/pay',auth(['STUDENT']),handler((req,res)=>ok(res,store.transaction(s=>payBooking(s,actor(req),String(req.params.id))))));
app.post('/api/bookings/:id/status',auth(),handler((req,res)=> { const status=req.body.status as BookingStatus;if(!['PENDING','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW','DISPUTED','REFUNDED'].includes(status))throw new DomainError('সঠিক স্ট্যাটাস দিন।');return ok(res,store.transaction(s=>changeBookingStatus(s,actor(req),String(req.params.id),status))); }));
app.post('/api/bookings/:id/notes',auth(['TEACHER']),handler((req,res)=> { const value=cleanText(req.body.notes,'ক্লাস নোট',4000);return ok(res,store.transaction(s=>{const b=s.bookings.find(x=>x.id===req.params.id&&x.teacherId===actor(req).id);if(!b)throw new DomainError('বুকিং পাওয়া যায়নি।',404);b.notes=value;s.notifications.push({id:id('notification'),userId:b.studentId,type:'NOTE',title:'নতুন ক্লাস নোট যোগ হয়েছে',body:'আপনার শিক্ষক ক্লাস নোট প্রকাশ করেছেন।',href:`/booking/${b.id}`,createdAt:new Date().toISOString()});return b;})); }));
app.post('/api/bookings/:id/recording',auth(['TEACHER']),handler((req,res)=>ok(res,store.transaction(s=>{const b=s.bookings.find(x=>x.id===req.params.id&&x.teacherId===actor(req).id);if(!b)throw new DomainError('বুকিং পাওয়া যায়নি।',404);b.recording={name:cleanText(req.body.name,'রেকর্ডিংয়ের নাম',160),duration:Number(req.body.duration)||0};return b;}))));

app.put('/api/teacher/profile',auth(['TEACHER']),handler((req,res)=>ok(res,store.transaction(s=>updateTeacher(s,actor(req),req.body)))));
app.put('/api/teacher/availability',auth(['TEACHER']),handler((req,res)=>ok(res,store.transaction(s=>{const teacher=s.teachers.find(t=>t.userId===actor(req).id); if(!teacher) throw new DomainError('শিক্ষক প্রোফাইল পাওয়া যায়নি।',404); const availability = req.body.availability && typeof req.body.availability === 'object' ? req.body.availability as Record<string,string[]> : teacher.availability; const input={...req.body,availability,isLive:req.body.isLive ?? true,lastSeenAt:new Date().toISOString()}; return updateTeacher(s,actor(req),input); }))));
app.get('/api/problem-sessions',auth(),handler((req,res)=>{
  const teachers = store.read().teachers.map(t => ({
    ...publicTeacher(store.read(), t),
    isLive: t.isLive ?? false,
    lastSeenAt: t.lastSeenAt ?? new Date().toISOString(),
    availableSlots: Object.values(t.availability || {}).flat().slice(0, 6)
  }));
  return ok(res, teachers.filter(x => x.isLive || x.availableSlots.length));
}));
app.post('/api/problem-sessions',auth(['STUDENT']),handler((req,res)=>ok(res,store.transaction(s=>createProblemSession(s,actor(req),req.body)),201)));
app.post('/api/teacher/gigs',auth(['TEACHER']),handler((req,res)=>ok(res,store.transaction(s=>createGig(s,actor(req),req.body)),201)));
app.get('/api/teacher/gig-drafts',auth(['TEACHER']),handler((req,res)=>ok(res,getGigDraft(store.read(),actor(req),typeof req.query.id==='string'?req.query.id:undefined))));
app.put('/api/teacher/gig-drafts',auth(['TEACHER']),handler((req,res)=>ok(res,store.transaction(s=>saveGigDraft(s,actor(req),req.body)))));
app.post('/api/teacher/gig-drafts/:id/publish',auth(['TEACHER']),handler((req,res)=>ok(res,store.transaction(s=>publishGigDraft(s,actor(req),String(req.params.id))),201)));
app.post('/api/teacher/gigs/:id/duplicate',auth(['TEACHER']),handler((req,res)=>ok(res,store.transaction(s=>duplicateGig(s,actor(req),String(req.params.id))),201)));
app.put('/api/teacher/gigs/:id',auth(['TEACHER']),handler((req,res)=>ok(res,store.transaction(s=>editGig(s,actor(req),String(req.params.id),req.body)))));
app.get('/api/teacher/gigs/:id/analytics',auth(['TEACHER']),handler((req,res)=>ok(res,store.read().gigAnalytics?.find(a=>a.gigId===req.params.id)||null)));
app.get('/api/teacher/gigs/:id/versions',auth(['TEACHER']),handler((req,res)=>ok(res,store.read().gigVersions?.filter(v=>v.gigId===req.params.id)||[])));
app.post('/api/teacher/gig-offers',auth(['TEACHER']),handler((req,res)=>ok(res,store.transaction(s=>createCustomOffer(s,actor(req),req.body)),201)));
app.get('/api/gig-offers',auth(),handler((req,res)=>ok(res,(store.read().gigOffers||[]).filter(o=>o.teacherId===actor(req).id||o.studentId===actor(req).id||actor(req).role==='ADMIN'))));
app.post('/api/gig-offers/:id/accept',auth(['STUDENT']),handler((req,res)=>ok(res,store.transaction(s=>acceptCustomOffer(s,actor(req),String(req.params.id))))));
app.get('/api/admin/gigs/pending',auth(['ADMIN','SUPER_ADMIN']),handler((_req,res)=>{const state=store.read();return ok(res,state.gigs.filter(g=>g.moderationStatus==='PENDING').map(g=>({...g,teacher:publicTeacher(state,state.teachers.find(t=>t.id===g.teacherId)!)})));}));
app.post('/api/admin/gigs/:id/moderation',auth(['ADMIN','SUPER_ADMIN']),handler((req,res)=>{const status=req.body.status;if(!['APPROVED','REJECTED','PENDING'].includes(status))throw new DomainError('সঠিক মডারেশন সিদ্ধান্ত দিন।');return ok(res,store.transaction(s=>{const gig=moderateGig(s,actor(req),String(req.params.id),status,cleanText(req.body.note||'মডারেশন সম্পন্ন','মডারেশন নোট',500));s.audit.push({id:id('audit'),actorId:actor(req).id,action:`gig_moderation_${status}`,entity:'Gig',entityId:gig.id,at:new Date().toISOString()});return gig;}));}));
app.get('/api/wallet',auth(['TEACHER']),handler((req,res)=>ok(res,wallet(store.read(),actor(req)))));
app.post('/api/wallet/payout',auth(['TEACHER']),handler((req,res)=>ok(res,store.transaction(s=>{const summary=wallet(s,actor(req));if(summary.pending<=0)throw new DomainError('উত্তোলনের জন্য কোনো পরীক্ষামূলক প্রাপ্য নেই।');s.ledger.push({id:id('ledger'),userId:actor(req).id,type:'PAYOUT',amount:-summary.pending,ref:'demo-payout',note:'পরীক্ষামূলক উত্তোলন — বাস্তব অর্থ স্থানান্তর নয়',createdAt:new Date().toISOString()});return {message:'পরীক্ষামূলক উত্তোলনের ধাপ সম্পন্ন হয়েছে।',amount:summary.pending};}))));

app.get('/api/messages',auth(),handler((req,res)=>ok(res,listConversations(store.read(),actor(req)))));
app.get('/api/messages/contacts/:userId',auth(),handler((req,res)=>{const state=store.read();const current=actor(req);conversation(state,current,String(req.params.userId));return ok(res,publicUser(requireUser(state,String(req.params.userId))))}));
app.get('/api/messages/:userId',auth(),handler((req,res)=>ok(res,conversation(store.read(),actor(req),String(req.params.userId)))));
app.post('/api/messages/:userId',auth(),handler((req,res)=>{const message=store.transaction(s=>sendMessage(s,actor(req),String(req.params.userId),req.body.body));const payload={type:'message',data:message};sendToUser(message.senderId,payload);sendToUser(message.receiverId,payload);return ok(res,message,201);}));
app.post('/api/messages/:userId/read',auth(),handler((req,res)=>ok(res,store.transaction(s=>markConversationRead(s,actor(req),String(req.params.userId))))));
app.get('/api/notifications',auth(),handler((req,res)=>ok(res,store.read().notifications.filter(n=>n.userId===actor(req).id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)))));
app.post('/api/notifications/:id/read',auth(),handler((req,res)=>ok(res,store.transaction(s=>{const n=s.notifications.find(x=>x.id===req.params.id&&x.userId===actor(req).id);if(!n)throw new DomainError('নোটিফিকেশন পাওয়া যায়নি।',404);n.readAt=new Date().toISOString();return n;}))));

app.get('/api/favorites',auth(['STUDENT']),handler((req,res)=>ok(res,store.read().favorites.filter(f=>f.userId===actor(req).id))));
app.post('/api/favorites',auth(['STUDENT']),handler((req,res)=>ok(res,store.transaction(s=>{const kind=req.body.kind as 'TEACHER'|'GIG'|'COURSE';const itemId=cleanText(req.body.itemId,'আইটেম',100);if(!['TEACHER','GIG','COURSE'].includes(kind))throw new DomainError('সঠিক আইটেম দিন।');const found=s.favorites.find(f=>f.userId===actor(req).id&&f.kind===kind&&f.itemId===itemId);if(found){s.favorites=s.favorites.filter(f=>f.id!==found.id);return {saved:false};}s.favorites.push({id:id('favorite'),userId:actor(req).id,kind,itemId,createdAt:new Date().toISOString()});return {saved:true};}))));
app.post('/api/reviews',auth(['STUDENT']),handler((req,res)=>ok(res,store.transaction(s=>createReview(s,actor(req),req.body)),201)));

app.get('/api/teacher/exams',auth(['TEACHER']),handler((req,res)=>ok(res,listTeacherExams(store.read(),actor(req)))));
app.post('/api/teacher/exams',auth(['TEACHER']),handler((req,res)=>ok(res,store.transaction(s=>createExam(s,actor(req),req.body)),201)));
app.put('/api/teacher/exams/:id',auth(['TEACHER']),handler((req,res)=>ok(res,store.transaction(s=>updateExam(s,actor(req),String(req.params.id),req.body)))));
app.delete('/api/teacher/exams/:id',auth(['TEACHER']),handler((req,res)=>ok(res,store.transaction(s=>deleteExam(s,actor(req),String(req.params.id))))));
app.post('/api/teacher/exams/:id/publish',auth(['TEACHER']),handler((req,res)=>ok(res,store.transaction(s=>publishExam(s,actor(req),String(req.params.id))))));
app.post('/api/teacher/exams/:id/status',auth(['TEACHER']),handler((req,res)=>{const status=req.body.status as 'PUBLISHED'|'CLOSED';if(!['PUBLISHED','CLOSED'].includes(status))throw new DomainError('সঠিক পরীক্ষার স্ট্যাটাস দিন।');return ok(res,store.transaction(s=>setExamStatus(s,actor(req),String(req.params.id),status)));}));
app.post('/api/teacher/exams/:id/duplicate',auth(['TEACHER']),handler((req,res)=>ok(res,store.transaction(s=>duplicateExam(s,actor(req),String(req.params.id))),201)));
app.get('/api/teacher/exams/:id/results',auth(['TEACHER']),handler((req,res)=>ok(res,teacherExamResults(store.read(),actor(req),String(req.params.id)))));
app.get('/api/exams',auth(),handler((req,res)=> {const state=store.read();return ok(res,state.exams.filter(e=>e.active&&(e.status===undefined||e.status==='PUBLISHED')).map(e=>({...e,questions:e.questionIds.length})));}));
app.get('/api/exams/share/:token',auth(['STUDENT']),handler((req,res)=>ok(res,getExamForStudent(store.read(),String(req.params.token)))));
app.get('/api/exams/:id',auth(['STUDENT']),handler((req,res)=>ok(res,getExamForStudent(store.read(),String(req.params.id)))));
app.post('/api/exams/:id/submit',auth(['STUDENT']),handler((req,res)=>ok(res,store.transaction(s=>submitExam(s,actor(req),String(req.params.id),req.body.answers||{})),201)));

// Student-created exam bank: answers stay on the server until the attempt is submitted.
app.get('/api/mcq/catalog',auth(['STUDENT']),handler(async(req,res)=>ok(res,await mcqCatalog({classLevel:req.query.classLevel,groupName:req.query.groupName,subject:req.query.subject,part:req.query.part,chapters:req.query.chapters?String(req.query.chapters).split(','):[]}))));
app.get('/api/mcq/attempts/active',auth(['STUDENT']),handler(async(req,res)=>ok(res,await getActiveMcqAttempt(actor(req)))));
app.post('/api/mcq/attempts',auth(['STUDENT']),handler(async(req,res)=>ok(res,await startMcqAttempt(actor(req),req.body),201)));
app.get('/api/mcq/attempts/:id',auth(['STUDENT']),handler(async(req,res)=>ok(res,await getMcqAttempt(actor(req),String(req.params.id)))));
app.post('/api/mcq/attempts/:id/answer',auth(['STUDENT']),handler(async(req,res)=>ok(res,await updateMcqAnswer(actor(req),String(req.params.id),req.body))));
app.post('/api/mcq/attempts/:id/submit',auth(['STUDENT']),handler(async(req,res)=>ok(res,await submitMcqAttempt(actor(req),String(req.params.id)))));
app.post('/api/mcq/attempts/:id/abandon',auth(['STUDENT']),handler(async(req,res)=>ok(res,await abandonMcqAttempt(actor(req),String(req.params.id)))));
app.get('/api/mcq/history',auth(['STUDENT']),handler(async(req,res)=>ok(res,await listMcqHistory(actor(req),Number(req.query.limit)||30))));
app.get('/api/mcq/profile',auth(['STUDENT']),handler(async(req,res)=>ok(res,await mcqProfile(actor(req)))));
app.get('/api/mcq/bookmarks',auth(['STUDENT']),handler(async(req,res)=>ok(res,await listMcqBookmarks(actor(req)))));
app.post('/api/mcq/bookmarks/:questionId',auth(['STUDENT']),handler(async(req,res)=>ok(res,await toggleMcqBookmark(actor(req),String(req.params.questionId)))));
app.get('/api/mcq/media/:id',auth(),handler(async(req,res)=>{const asset=await mcqMedia(String(req.params.id));res.setHeader('Cache-Control','private, max-age=3600');res.type(asset.mediaType).send(asset.data);}));
app.get('/api/admin/mcq/summary',auth(['ADMIN','SUPER_ADMIN']),handler(async(_req,res)=>ok(res,await adminMcqSummary())));
app.get('/api/admin/mcq/sources',auth(['ADMIN','SUPER_ADMIN']),handler(async(req,res)=>ok(res,await adminMcqSources(req.query))));
app.get('/api/admin/mcq/issues',auth(['ADMIN','SUPER_ADMIN']),handler(async(req,res)=>ok(res,await adminMcqIssues(req.query))));
app.get('/api/admin/mcq/questions',auth(['ADMIN','SUPER_ADMIN']),handler(async(req,res)=>ok(res,await adminMcqQuestions(req.query))));
app.post('/api/admin/mcq/import/batch',auth(['ADMIN','SUPER_ADMIN']),handler(async(req,res)=>ok(res,await uploadMcqBatch(actor(req),req.body),201)));
app.post('/api/admin/mcq/import/finalize',auth(['ADMIN','SUPER_ADMIN']),handler(async(req,res)=>ok(res,await finalizeMcqImport(actor(req),req.body))));
app.post('/api/admin/mcq/import/failure',auth(['ADMIN','SUPER_ADMIN']),handler(async(req,res)=>ok(res,await importFailure(actor(req),req.body),201)));
app.post('/api/admin/mcq/issues/:id/resolve',auth(['ADMIN','SUPER_ADMIN']),handler(async(req,res)=>ok(res,await resolveMcqIssue(actor(req),String(req.params.id),req.body))));
app.post('/api/admin/mcq/questions/:id/status',auth(['ADMIN','SUPER_ADMIN']),handler(async(req,res)=>ok(res,await setMcqQuestionStatus(actor(req),String(req.params.id),String(req.body.status||'')))));

app.get('/api/problems',handler((_req,res)=> {const state=store.read();return ok(res,state.problems.map(p=>({...p,student:publicUser(requireUser(state,p.studentId)),offers:state.offers.filter(o=>o.problemId===p.id)})));}));
app.post('/api/problems',auth(['STUDENT']),handler((req,res)=>ok(res,store.transaction(s=>{const p={id:id('problem'),studentId:actor(req).id,title:cleanText(req.body.title,'সমস্যার শিরোনাম',160),description:cleanText(req.body.description,'বর্ণনা'),subject:cleanText(req.body.subject,'বিষয়',80),topic:cleanText(req.body.topic,'টপিক',80),budget:Number(req.body.budget),deadline:cleanText(req.body.deadline,'সময়সীমা',20),status:'OPEN' as const,createdAt:new Date().toISOString()};if(!Number.isFinite(p.budget)||p.budget<1)throw new DomainError('সঠিক বাজেট দিন।');s.problems.push(p);return p;}),201)));
app.post('/api/problems/:id/offers',auth(['TEACHER']),handler((req,res)=>ok(res,store.transaction(s=>{const p=s.problems.find(x=>x.id===req.params.id&&x.status==='OPEN');if(!p)throw new DomainError('সমস্যাটি এখন অফারের জন্য খোলা নেই।',404);const offer={id:id('offer'),problemId:p.id,teacherId:actor(req).id,message:cleanText(req.body.message,'প্রস্তাব',1000),price:Number(req.body.price),status:'PENDING' as const,createdAt:new Date().toISOString()};if(!Number.isFinite(offer.price)||offer.price<1)throw new DomainError('সঠিক মূল্য দিন।');s.offers.push(offer);return offer;}),201)));
app.post('/api/problems/:id/offers/:offerId/accept',auth(['STUDENT']),handler((req,res)=>ok(res,store.transaction(s=>{const p=s.problems.find(x=>x.id===req.params.id&&x.studentId===actor(req).id);const offer=s.offers.find(x=>x.id===req.params.offerId&&x.problemId===req.params.id);if(!p||!offer)throw new DomainError('প্রস্তাব পাওয়া যায়নি।',404);p.status='ACCEPTED';offer.status='ACCEPTED';s.offers.filter(o=>o.problemId===p.id&&o.id!==offer.id).forEach(o=>o.status='REJECTED');return {p,offer};}))));

app.get('/api/admin/users',auth(['ADMIN','SUPER_ADMIN']),handler((_req,res)=>ok(res,store.read().users.map(user=>({...publicUser(user),createdAt:user.createdAt,active:user.active})))));
app.get('/api/admin/payments',auth(['ADMIN','SUPER_ADMIN']),handler((_req,res)=>{const state=store.read();return ok(res,state.payments.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(payment=>({...payment,student:publicUser(requireUser(state,payment.studentId)),booking:state.bookings.find(booking=>booking.id===payment.bookingId)})));}));
app.get('/api/admin/reports',auth(['ADMIN','SUPER_ADMIN']),handler((_req,res)=>{const state=store.read();return ok(res,state.reports.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(report=>({...report,reporter:publicUser(requireUser(state,report.reporterId))})));}));
app.post('/api/admin/reports/:id/status',auth(['ADMIN','SUPER_ADMIN']),handler((req,res)=>{const status=req.body.status;if(!['OPEN','RESOLVED'].includes(status))throw new DomainError('সঠিক রিপোর্টের অবস্থা দিন।');return ok(res,store.transaction(s=>{const report=s.reports.find(item=>item.id===req.params.id);if(!report)throw new DomainError('রিপোর্ট পাওয়া যায়নি।',404);report.status=status;s.audit.push({id:id('audit'),actorId:actor(req).id,action:`report_${status}`,entity:'Report',entityId:report.id,at:new Date().toISOString()});return report;}));}));
app.get('/api/admin/audit',auth(['ADMIN','SUPER_ADMIN']),handler((_req,res)=>{const state=store.read();return ok(res,state.audit.slice().sort((a,b)=>b.at.localeCompare(a.at)).slice(0,100).map(entry=>({...entry,actor:publicUser(requireUser(state,entry.actorId))})));}));
app.get('/api/admin/teachers/pending',auth(['ADMIN','SUPER_ADMIN']),handler((_req,res)=>{const s=store.read();return ok(res,s.teachers.filter(t=>t.verificationStatus==='PENDING').map(t=>publicTeacher(s,t)));}));
app.post('/api/admin/teachers/:id/verification',auth(['ADMIN','SUPER_ADMIN']),handler((req,res)=>ok(res,store.transaction(s=>{const t=s.teachers.find(x=>x.id===req.params.id);if(!t)throw new DomainError('শিক্ষক পাওয়া যায়নি।',404);const status=req.body.status;if(!['APPROVED','REJECTED','PENDING'].includes(status))throw new DomainError('সঠিক সিদ্ধান্ত দিন।');t.verificationStatus=status;t.verified=status==='APPROVED';s.audit.push({id:id('audit'),actorId:actor(req).id,action:`verification_${status}`,entity:'Teacher',entityId:t.id,at:new Date().toISOString()});s.notifications.push({id:id('notification'),userId:t.userId,type:'VERIFICATION',title:'যাচাইকরণের অবস্থা বদলেছে',body:status==='APPROVED'?'আপনার শিক্ষক পরিচিতি যাচাইকৃত হয়েছে।':'আপনার যাচাইকরণে পরিবর্তন প্রয়োজন।',href:'/dashboard',createdAt:new Date().toISOString()});return t;}))));
app.post('/api/reports',auth(),handler((req,res)=>ok(res,store.transaction(s=>{const report={id:id('report'),reporterId:actor(req).id,subjectType:cleanText(req.body.subjectType,'বিষয়ের ধরন',80),subjectId:cleanText(req.body.subjectId,'বিষয়',100),reason:cleanText(req.body.reason,'কারণ',1000),status:'OPEN' as const,createdAt:new Date().toISOString()};s.reports.push(report);return report;}),201)));

app.use((error:unknown,_req:Request,res:Response,next:NextFunction)=>{void next;const known=error instanceof DomainError;console.error(error);res.status(known?error.status:500).json({ok:false,message:known?error.message:'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।'});});
const client=resolve(process.cwd(),'dist','client');if(existsSync(client)){app.use(express.static(client));app.get(/.*/,(req,res)=>res.sendFile(resolve(client,'index.html')));}
const httpServer=createServer(app);
const sockets=new Map<string,Set<WebSocket>>();
const sendToUser=(userId:string,payload:unknown)=>{for(const socket of sockets.get(userId)||[])if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify(payload));};
const wsUser=(request:import('node:http').IncomingMessage)=>{const token=request.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('shikhok_session='))?.slice('shikhok_session='.length);const userId=token&&sessions.get(token);return userId?store.read().users.find(u=>u.id===userId):undefined;};
type ClassroomSocket = { socket: WebSocket; userId: string; user: { id: string; name: string; role: Role }; camera: boolean; mic: boolean; screen: boolean };
const classroomRooms=new Map<string,Set<ClassroomSocket>>();
const socketRooms=new Map<WebSocket,{bookingId:string;participant:ClassroomSocket}>();
const sendSocket=(socket:WebSocket,payload:unknown)=>{if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify(payload));};
const sendClassroom=(bookingId:string,payload:unknown,except?:WebSocket)=>{for(const participant of classroomRooms.get(bookingId)||[])if(participant.socket!==except)sendSocket(participant.socket,payload);};
const leaveClassroom=(socket:WebSocket)=>{const current=socketRooms.get(socket);if(!current)return;const room=classroomRooms.get(current.bookingId);room?.delete(current.participant);socketRooms.delete(socket);sendClassroom(current.bookingId,{type:'classroom:peer-left',userId:current.participant.userId},socket);if(!room?.size)classroomRooms.delete(current.bookingId);};
const wsServer=new WebSocketServer({server:httpServer,path:'/ws',maxPayload:8*1024*1024});
wsServer.on('connection',(socket,request)=>{
  const user=wsUser(request); if(!user){socket.close(1008,'Authentication required');return;}
  const userSockets=sockets.get(user.id)||new Set<WebSocket>(); userSockets.add(socket); sockets.set(user.id,userSockets);
  socket.on('message',raw=>{try{
    const input=JSON.parse(raw.toString()) as {type?:string;to?:string;body?:unknown;bookingId?:string;data?:unknown;board?:ClassroomBoard;camera?:boolean;mic?:boolean;screen?:boolean};
    if(input.type==='classroom:join'){
      const bookingId=String(input.bookingId||'');
      const booking=store.read().bookings.find(item=>item.id===bookingId);
      if(!booking||![booking.studentId,booking.teacherId].includes(user.id)||!['CONFIRMED','IN_PROGRESS'].includes(booking.status))throw new DomainError('এই বুকিংয়ের অংশগ্রহণকারী হিসেবে ক্লাসে যোগ দেওয়া যাচ্ছে না।',403);
      leaveClassroom(socket);
      const state=store.read();
      const participant:ClassroomSocket={socket,userId:user.id,user:publicUser(user),camera:false,mic:false,screen:false};
      const room=classroomRooms.get(bookingId)||new Set<ClassroomSocket>();
      const peers=[...room].filter(peer=>peer.userId!==user.id);
      room.add(participant);classroomRooms.set(bookingId,room);socketRooms.set(socket,{bookingId,participant});
      const roomData=state.classroomData?.[bookingId];
      sendSocket(socket,{type:'classroom:joined',bookingId,user:participant.user,peers:peers.map(peer=>({user:peer.user,camera:peer.camera,mic:peer.mic,screen:peer.screen})),board:roomData?.board,chat:roomData?.chat||[]});
      sendClassroom(bookingId,{type:'classroom:peer-joined',user:participant.user,camera:false,mic:false,screen:false},socket);
      return;
    }
    if(input.type==='classroom:leave'){leaveClassroom(socket);return;}
    if(input.type==='classroom:offer'||input.type==='classroom:answer'||input.type==='classroom:ice'){
      const room=socketRooms.get(socket);if(!room)throw new DomainError('আগে ক্লাসরুমে যুক্ত হন।',403);
      const target=String(input.to||'');if(![...classroomRooms.get(room.bookingId)||[]].some(peer=>peer.userId===target))throw new DomainError('ক্লাসে এই অংশগ্রহণকারীকে পাওয়া যায়নি।',404);
      const signal={type:input.type,fromId:user.id,data:input.data};
      for(const peer of classroomRooms.get(room.bookingId)||[])if(peer.userId===target)sendSocket(peer.socket,signal);
      return;
    }
    if(input.type==='classroom:media'||input.type==='classroom:board'||input.type==='classroom:chat'){
      const room=socketRooms.get(socket);if(!room)throw new DomainError('আগে ক্লাসরুমে যুক্ত হন।',403);
      const members=classroomRooms.get(room.bookingId)||new Set<ClassroomSocket>();
      if(input.type==='classroom:media'){
        const member=[...members].find(peer=>peer.socket===socket);if(!member)throw new DomainError('ক্লাস সংযোগ পাওয়া যায়নি।');
        member.camera=input.camera===true;member.mic=input.mic===true;member.screen=input.screen===true;
        sendClassroom(room.bookingId,{type:'classroom:media',userId:user.id,camera:member.camera,mic:member.mic,screen:member.screen},socket);return;
      }
      if(input.type==='classroom:board'){
        const board=input.board;
        if(!board||!Array.isArray(board.pages)||board.pages.length<1||board.pages.length>8||!Number.isInteger(board.page)||board.page<0||board.page>=board.pages.length)throw new DomainError('হোয়াইটবোর্ডের তথ্য সঠিক নয়।');
        const pages=board.pages.map((page:string)=>{if(page===''||page==='white')return page;if(typeof page!=='string'||page.length>900_000||!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(page))throw new DomainError('হোয়াইটবোর্ডের পাতার আকার সীমার বাইরে।');return page;});
        if(pages.reduce((sum,page)=>sum+page.length,0)>6*1024*1024)throw new DomainError('হোয়াইটবোর্ডের মোট আকার সীমার বাইরে।');
        const saved={pages,page:board.page};
        store.transaction(state=>{state.classroomData??={};const roomData=state.classroomData[room.bookingId]??(state.classroomData[room.bookingId]={chat:[],updatedAt:new Date().toISOString()});roomData.board=saved;roomData.updatedAt=new Date().toISOString();});
        sendClassroom(room.bookingId,{type:'classroom:board',board:saved,fromId:user.id},socket);return;
      }
      const text=cleanText(input.body,'ক্লাস বার্তা',1000);
      const chatMessage={id:id('class-chat'),senderId:user.id,name:user.name,text,createdAt:new Date().toISOString()};
      store.transaction(state=>{state.classroomData??={};const roomData=state.classroomData[room.bookingId]??(state.classroomData[room.bookingId]={chat:[],updatedAt:new Date().toISOString()});roomData.chat.push(chatMessage);roomData.chat=roomData.chat.slice(-200);roomData.updatedAt=chatMessage.createdAt;});
      sendClassroom(room.bookingId,{type:'classroom:chat',message:chatMessage},socket);sendSocket(socket,{type:'classroom:chat',message:chatMessage});return;
    }
    if(input.type!=='message'||!input.to)throw new DomainError('বার্তার গंतব্য সঠিক নয়।');const message=store.transaction(s=>sendMessage(s,user,input.to!,input.body));const payload={type:'message',data:message};sendToUser(user.id,payload);sendToUser(message.receiverId,payload);
  }catch(error){sendSocket(socket,{type:'error',message:error instanceof Error?error.message:'বার্তা পাঠানো যায়নি।'});}});
  socket.on('close',()=>{leaveClassroom(socket);userSockets.delete(socket);if(!userSockets.size)sockets.delete(user.id);});
});
if(process.env.BOOTSTRAP_ADMIN_EMAIL&&process.env.BOOTSTRAP_ADMIN_PASSWORD){
  const email=process.env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();
  const password=process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if(password.length<16)throw new Error('BOOTSTRAP_ADMIN_PASSWORD must contain at least 16 characters.');
  store.transaction(state=>{let user=state.users.find(item=>item.email===email);if(!user){const registered=register(state,{name:process.env.BOOTSTRAP_ADMIN_NAME||'Private Tutor Admin',email,password,role:'STUDENT'});user=state.users.find(item=>item.id===registered.id)!;}user.role='ADMIN';user.passwordHash=passwordHash(password);});
  if(process.env.DATABASE_URL){
    const localAdmin=store.read().users.find(item=>item.email===email)!;
    const durableAdmin=await persistMcqBootstrapAdmin(localAdmin);
    store.transaction(state=>{const user=state.users.find(item=>item.email===email)!;Object.assign(user,durableAdmin);});
  }
}
setInterval(()=>{void autoSubmitExpiredMcqAttempts().catch(error=>console.error('MCQ auto-submit sweep failed',error));},30_000).unref();
httpServer.listen(port,()=>console.log(`শিখোক সার্ভার: http://localhost:${port}`));

export { app };
