import express, { type Request, type Response, type NextFunction } from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { store } from './store.js';
import { DomainError, authenticate, changeBookingStatus, cleanText, conversation, createBooking, createGig, createReview, findTeachers, matchTeachers, payBooking, publicTeacher, publicUser, register, requireRole, requireUser, sendMessage, submitExam, updateTeacher, wallet } from './services.js';
import { id } from './seed.js';
import type { BookingStatus, Role, User } from './types.js';
import { getGigDraft, publishGigDraft, saveGigDraft } from './gig-builder.js';

const app = express();
const sessions = new Map<string, string>();
const port = Number(process.env.PORT || 3001);
app.disable('x-powered-by');
app.use((_req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','SAMEORIGIN');res.setHeader('Referrer-Policy','same-origin');next();});
app.use(express.json({ limit: '1mb' }));

const cookie = (req: Request, name: string) => req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith(`${name}=`))?.slice(name.length+1);
const setSession = (res: Response, userId: string) => { const token=randomUUID();sessions.set(token,userId);res.setHeader('Set-Cookie',`shikhok_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${process.env.NODE_ENV==='production'?'; Secure':''}`); };
const currentUser = (req: Request) => { const token=cookie(req,'shikhok_session');const userId=token&&sessions.get(token);return userId?store.read().users.find(u=>u.id===userId):undefined; };
const auth = (roles?: Role[]) => (req:Request,_res:Response,next:NextFunction) => { try { const user=currentUser(req);if(!user)throw new DomainError('এই পেজটি দেখতে আগে লগইন করুন।',401);if(roles)requireRole(user,roles);(req as Request & { user:User }).user=user;next();}catch(e){next(e);} };
const handler = (fn:(req:Request,res:Response)=>unknown) => (req:Request,res:Response,next:NextFunction) => { try { void Promise.resolve(fn(req,res)).catch(next); } catch (e) { next(e); } };
const actor = (req: Request) => (req as Request & { user: User }).user;
const ok = (res:Response,data:unknown,status=200) => res.status(status).json({ ok:true,data });

app.get('/api/health', (_req,res)=>ok(res,{status:'লোকাল ডেমো সার্ভার সচল',mode:'local-demo'}));
app.post('/api/auth/login', handler((req,res)=> { const user=authenticate(store.read(),req.body.email,req.body.password);setSession(res,user.id);return ok(res,user); }));
app.post('/api/auth/register', handler((req,res)=> { const user=store.transaction(s=>register(s,req.body));setSession(res,user.id);return ok(res,user,201); }));
app.post('/api/auth/logout', handler((req,res)=> { const token=cookie(req,'shikhok_session');if(token)sessions.delete(token);res.setHeader('Set-Cookie','shikhok_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');return ok(res,{message:'আপনি সফলভাবে লগআউট করেছেন।'}); }));
app.get('/api/auth/me', handler((req,res)=> { const user=currentUser(req);if(!user)throw new DomainError('লগইন সেশন নেই।',401);return ok(res,publicUser(user)); }));

app.get('/api/subjects', handler((_req,res)=>ok(res,store.read().subjects)));
app.get('/api/teachers', handler((req,res)=>ok(res,findTeachers(store.read(),req.query))));
app.get('/api/matches', handler((req,res)=>ok(res,matchTeachers(store.read(),req.query))));
app.get('/api/teachers/:id', handler((req,res)=> { const state=store.read();const teacher=state.teachers.find(t=>t.id===req.params.id);if(!teacher)throw new DomainError('শিক্ষক পাওয়া যায়নি।',404);return ok(res,{...publicTeacher(state,teacher),reviews:state.reviews.filter(r=>r.teacherId===teacher.id).slice(-12)}); }));
app.get('/api/gigs', handler((req,res)=> { const state=store.read();let gigs=state.gigs.filter(g=>g.active);if(req.query.subject)gigs=gigs.filter(g=>g.subject===req.query.subject);if(req.query.q){const q=String(req.query.q).toLowerCase();gigs=gigs.filter(g=>`${g.title} ${g.description} ${g.topic}`.toLowerCase().includes(q));}return ok(res,gigs.map(g=>({...g,teacher:publicTeacher(state,state.teachers.find(t=>t.id===g.teacherId)!)}))); }));
app.get('/api/gigs/:id', handler((req,res)=> { const state=store.read();const gig=state.gigs.find(g=>g.id===req.params.id&&g.active);if(!gig)throw new DomainError('গিগটি পাওয়া যায়নি।',404);return ok(res,{...gig,teacher:publicTeacher(state,state.teachers.find(t=>t.id===gig.teacherId)!),reviews:state.reviews.filter(r=>r.teacherId===gig.teacherId).slice(-10)}); }));

app.get('/api/dashboard', auth(), handler((req,res)=> { const state=store.read(), user=actor(req);const bookings=state.bookings.filter(b=>b.studentId===user.id||b.teacherId===user.id); const payload:any={user:publicUser(user),bookings,notifications:state.notifications.filter(n=>n.userId===user.id).slice(-8).reverse(),unread:state.notifications.filter(n=>n.userId===user.id&&!n.readAt).length}; if(user.role==='TEACHER'){const t=state.teachers.find(x=>x.userId===user.id);payload.teacher=t;payload.wallet=wallet(state,user);payload.gigs=state.gigs.filter(g=>g.teacherId===user.id);payload.analytics={profileViews:t?.profileViews||0,gigViews:t?.gigViews||0,bookings:bookings.length,completed:bookings.filter(b=>b.status==='COMPLETED').length,rating:t?.rating||0};}if(user.role==='STUDENT'){payload.favorites=state.favorites.filter(f=>f.userId===user.id);payload.attempts=state.attempts.filter(a=>a.studentId===user.id);}if(user.role==='PARENT'){const children=state.parentChildren.filter(p=>p.parentId===user.id).map(p=>requireUser(state,p.childId));payload.children=children.map(c=>({...publicUser(c),bookings:state.bookings.filter(b=>b.studentId===c.id),attempts:state.attempts.filter(a=>a.studentId===c.id)}));}if(['ADMIN','SUPER_ADMIN'].includes(user.role))payload.admin={users:state.users.length,teachers:state.teachers.length,pending:state.teachers.filter(t=>t.verificationStatus==='PENDING').length,payments:state.payments.length,reports:state.reports.filter(r=>r.status==='OPEN').length};return ok(res,payload); }));

app.get('/api/bookings', auth(), handler((req,res)=> { const user=actor(req);const data=store.read().bookings.filter(b=>user.role==='ADMIN'||b.studentId===user.id||b.teacherId===user.id);return ok(res,data); }));
app.post('/api/bookings',auth(['STUDENT']),handler((req,res)=>ok(res,store.transaction(s=>createBooking(s,actor(req),req.body)),201)));
app.post('/api/bookings/:id/pay',auth(['STUDENT']),handler((req,res)=>ok(res,store.transaction(s=>payBooking(s,actor(req),String(req.params.id))))));
app.post('/api/bookings/:id/status',auth(),handler((req,res)=> { const status=req.body.status as BookingStatus;if(!['PENDING','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW','DISPUTED','REFUNDED'].includes(status))throw new DomainError('সঠিক স্ট্যাটাস দিন।');return ok(res,store.transaction(s=>changeBookingStatus(s,actor(req),String(req.params.id),status))); }));
app.post('/api/bookings/:id/notes',auth(['TEACHER']),handler((req,res)=> { const value=cleanText(req.body.notes,'ক্লাস নোট',4000);return ok(res,store.transaction(s=>{const b=s.bookings.find(x=>x.id===req.params.id&&x.teacherId===actor(req).id);if(!b)throw new DomainError('বুকিং পাওয়া যায়নি।',404);b.notes=value;s.notifications.push({id:id('notification'),userId:b.studentId,type:'NOTE',title:'নতুন ক্লাস নোট যোগ হয়েছে',body:'আপনার শিক্ষক ক্লাস নোট প্রকাশ করেছেন।',href:`/booking/${b.id}`,createdAt:new Date().toISOString()});return b;})); }));
app.post('/api/bookings/:id/recording',auth(['TEACHER']),handler((req,res)=>ok(res,store.transaction(s=>{const b=s.bookings.find(x=>x.id===req.params.id&&x.teacherId===actor(req).id);if(!b)throw new DomainError('বুকিং পাওয়া যায়নি।',404);b.recording={name:cleanText(req.body.name,'রেকর্ডিংয়ের নাম',160),duration:Number(req.body.duration)||0};return b;}))));

app.put('/api/teacher/profile',auth(['TEACHER']),handler((req,res)=>ok(res,store.transaction(s=>updateTeacher(s,actor(req),req.body)))));
app.post('/api/teacher/gigs',auth(['TEACHER']),handler((req,res)=>ok(res,store.transaction(s=>createGig(s,actor(req),req.body)),201)));
app.get('/api/teacher/gig-drafts',auth(['TEACHER']),handler((req,res)=>ok(res,getGigDraft(store.read(),actor(req),typeof req.query.id==='string'?req.query.id:undefined))));
app.put('/api/teacher/gig-drafts',auth(['TEACHER']),handler((req,res)=>ok(res,store.transaction(s=>saveGigDraft(s,actor(req),req.body)))));
app.post('/api/teacher/gig-drafts/:id/publish',auth(['TEACHER']),handler((req,res)=>ok(res,store.transaction(s=>publishGigDraft(s,actor(req),String(req.params.id))),201)));
app.get('/api/wallet',auth(['TEACHER']),handler((req,res)=>ok(res,wallet(store.read(),actor(req)))));
app.post('/api/wallet/payout',auth(['TEACHER']),handler((req,res)=>ok(res,store.transaction(s=>{const summary=wallet(s,actor(req));if(summary.pending<=0)throw new DomainError('উত্তোলনের জন্য কোনো ডেমো প্রাপ্য নেই।');s.ledger.push({id:id('ledger'),userId:actor(req).id,type:'PAYOUT',amount:-summary.pending,ref:'demo-payout',note:'ডেমো উত্তোলন — কোনো বাস্তব অর্থ নয়',createdAt:new Date().toISOString()});return {message:'ডেমো উত্তোলনের অনুরোধ সম্পন্ন হয়েছে।',amount:summary.pending};}))));

app.get('/api/messages/:userId',auth(),handler((req,res)=>ok(res,conversation(store.read(),actor(req),String(req.params.userId)))));
app.post('/api/messages/:userId',auth(),handler((req,res)=>ok(res,store.transaction(s=>sendMessage(s,actor(req),String(req.params.userId),req.body.body)),201)));
app.get('/api/notifications',auth(),handler((req,res)=>ok(res,store.read().notifications.filter(n=>n.userId===actor(req).id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)))));
app.post('/api/notifications/:id/read',auth(),handler((req,res)=>ok(res,store.transaction(s=>{const n=s.notifications.find(x=>x.id===req.params.id&&x.userId===actor(req).id);if(!n)throw new DomainError('নোটিফিকেশন পাওয়া যায়নি।',404);n.readAt=new Date().toISOString();return n;}))));

app.get('/api/favorites',auth(['STUDENT']),handler((req,res)=>ok(res,store.read().favorites.filter(f=>f.userId===actor(req).id))));
app.post('/api/favorites',auth(['STUDENT']),handler((req,res)=>ok(res,store.transaction(s=>{const kind=req.body.kind as 'TEACHER'|'GIG'|'COURSE';const itemId=cleanText(req.body.itemId,'আইটেম',100);if(!['TEACHER','GIG','COURSE'].includes(kind))throw new DomainError('সঠিক আইটেম দিন।');const found=s.favorites.find(f=>f.userId===actor(req).id&&f.kind===kind&&f.itemId===itemId);if(found){s.favorites=s.favorites.filter(f=>f.id!==found.id);return {saved:false};}s.favorites.push({id:id('favorite'),userId:actor(req).id,kind,itemId,createdAt:new Date().toISOString()});return {saved:true};}))));
app.post('/api/reviews',auth(['STUDENT']),handler((req,res)=>ok(res,store.transaction(s=>createReview(s,actor(req),req.body)),201)));

app.get('/api/exams',auth(),handler((_req,res)=> {const state=store.read();return ok(res,state.exams.filter(e=>e.active).map(e=>({...e,questions:e.questionIds.length})));}));
app.get('/api/exams/:id',auth(['STUDENT']),handler((req,res)=>{const state=store.read(),exam=state.exams.find(e=>e.id===String(req.params.id)&&e.active);if(!exam)throw new DomainError('পরীক্ষাটি পাওয়া যায়নি।',404);return ok(res,{...exam,questions:exam.questionIds.map(qid=>{const q=state.questions.find(x=>x.id===qid)!;return {id:q.id,text:q.text,options:q.options,marks:q.marks};})});}));
app.post('/api/exams/:id/submit',auth(['STUDENT']),handler((req,res)=>ok(res,store.transaction(s=>submitExam(s,actor(req),String(req.params.id),req.body.answers||{})),201)));

app.get('/api/problems',handler((_req,res)=> {const state=store.read();return ok(res,state.problems.map(p=>({...p,student:publicUser(requireUser(state,p.studentId)),offers:state.offers.filter(o=>o.problemId===p.id)})));}));
app.post('/api/problems',auth(['STUDENT']),handler((req,res)=>ok(res,store.transaction(s=>{const p={id:id('problem'),studentId:actor(req).id,title:cleanText(req.body.title,'সমস্যার শিরোনাম',160),description:cleanText(req.body.description,'বর্ণনা'),subject:cleanText(req.body.subject,'বিষয়',80),topic:cleanText(req.body.topic,'টপিক',80),budget:Number(req.body.budget),deadline:cleanText(req.body.deadline,'সময়সীমা',20),status:'OPEN' as const,createdAt:new Date().toISOString()};if(!Number.isFinite(p.budget)||p.budget<1)throw new DomainError('সঠিক বাজেট দিন।');s.problems.push(p);return p;}),201)));
app.post('/api/problems/:id/offers',auth(['TEACHER']),handler((req,res)=>ok(res,store.transaction(s=>{const p=s.problems.find(x=>x.id===req.params.id&&x.status==='OPEN');if(!p)throw new DomainError('সমস্যাটি এখন অফারের জন্য খোলা নেই।',404);const offer={id:id('offer'),problemId:p.id,teacherId:actor(req).id,message:cleanText(req.body.message,'প্রস্তাব',1000),price:Number(req.body.price),status:'PENDING' as const,createdAt:new Date().toISOString()};if(!Number.isFinite(offer.price)||offer.price<1)throw new DomainError('সঠিক মূল্য দিন।');s.offers.push(offer);return offer;}),201)));
app.post('/api/problems/:id/offers/:offerId/accept',auth(['STUDENT']),handler((req,res)=>ok(res,store.transaction(s=>{const p=s.problems.find(x=>x.id===req.params.id&&x.studentId===actor(req).id);const offer=s.offers.find(x=>x.id===req.params.offerId&&x.problemId===req.params.id);if(!p||!offer)throw new DomainError('প্রস্তাব পাওয়া যায়নি।',404);p.status='ACCEPTED';offer.status='ACCEPTED';s.offers.filter(o=>o.problemId===p.id&&o.id!==offer.id).forEach(o=>o.status='REJECTED');return {p,offer};}))));

app.get('/api/admin/users',auth(['ADMIN','SUPER_ADMIN']),handler((_req,res)=>ok(res,store.read().users.map(publicUser))));
app.get('/api/admin/teachers/pending',auth(['ADMIN','SUPER_ADMIN']),handler((_req,res)=>{const s=store.read();return ok(res,s.teachers.filter(t=>t.verificationStatus==='PENDING').map(t=>publicTeacher(s,t)));}));
app.post('/api/admin/teachers/:id/verification',auth(['ADMIN','SUPER_ADMIN']),handler((req,res)=>ok(res,store.transaction(s=>{const t=s.teachers.find(x=>x.id===req.params.id);if(!t)throw new DomainError('শিক্ষক পাওয়া যায়নি।',404);const status=req.body.status;if(!['APPROVED','REJECTED','PENDING'].includes(status))throw new DomainError('সঠিক সিদ্ধান্ত দিন।');t.verificationStatus=status;t.verified=status==='APPROVED';s.audit.push({id:id('audit'),actorId:actor(req).id,action:`verification_${status}`,entity:'Teacher',entityId:t.id,at:new Date().toISOString()});s.notifications.push({id:id('notification'),userId:t.userId,type:'VERIFICATION',title:'যাচাইকরণের অবস্থা বদলেছে',body:status==='APPROVED'?'আপনার শিক্ষক পরিচিতি যাচাইকৃত হয়েছে।':'আপনার যাচাইকরণে পরিবর্তন প্রয়োজন।',href:'/dashboard',createdAt:new Date().toISOString()});return t;}))));
app.post('/api/reports',auth(),handler((req,res)=>ok(res,store.transaction(s=>{const report={id:id('report'),reporterId:actor(req).id,subjectType:cleanText(req.body.subjectType,'বিষয়ের ধরন',80),subjectId:cleanText(req.body.subjectId,'বিষয়',100),reason:cleanText(req.body.reason,'কারণ',1000),status:'OPEN' as const,createdAt:new Date().toISOString()};s.reports.push(report);return report;}),201)));

app.use((error:unknown,_req:Request,res:Response,next:NextFunction)=>{void next;const known=error instanceof DomainError;console.error(error);res.status(known?error.status:500).json({ok:false,message:known?error.message:'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।'});});
const client=resolve(process.cwd(),'dist','client');if(existsSync(client)){app.use(express.static(client));app.get(/.*/,(req,res)=>res.sendFile(resolve(client,'index.html')));}
app.listen(port,()=>console.log(`শিখক লোকাল ডেমো সার্ভার: http://localhost:${port}`));

export { app };
