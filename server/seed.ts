import { randomUUID, scryptSync, randomBytes } from 'node:crypto';
import type { AppState, Role, User } from './types.js';

const now = () => new Date().toISOString();
export const passwordHash = (value: string) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(value, salt, 64).toString('hex')}`;
};
export const verifyPassword = (value: string, saved: string) => {
  const [salt, digest] = saved.split(':');
  return Boolean(salt && digest) && scryptSync(value, salt, 64).toString('hex') === digest;
};
const bnNames = ['আরিফ হোসেন','নুসরাত জাহান','তানভীর আহমেদ','মিতু রহমান','সাদিয়া ইসলাম','রাফি হাসান','তামান্না আক্তার','মাহিন চৌধুরী','সাবিনা ইয়াসমিন','ফারহান কবির','নাবিলা সুলতানা','শাওন মিয়া','রুবাইয়া ইসলাম','তৌহিদুল আলম','ইশরাত জাহান','সজীব খান','রিমি আক্তার','শাহরিয়ার রাফি','মেহেদী হাসান','প্রিয়ন্তী দাস'];
const subjects = [
  ['গণিত','➗',['বীজগণিত','ক্যালকুলাস','জ্যামিতি']], ['পদার্থবিজ্ঞান','⚛️',['বিদ্যুৎ','গতিবিদ্যা','তরঙ্গ']], ['রসায়ন','🧪',['জৈব রসায়ন','পর্যায় সারণি','মোল']], ['জীববিজ্ঞান','🧬',['কোষ','জিনতত্ত্ব','প্রাণিবিজ্ঞান']], ['ইংরেজি','🔤',['গ্রামার','রাইটিং','স্পিকিং']], ['বাংলা','📖',['ব্যাকরণ','সাহিত্য','রচনা']], ['আইসিটি','💻',['ডেটাবেজ','ওয়েব ডিজাইন','সংখ্যা পদ্ধতি']], ['হিসাববিজ্ঞান','📊',['জার্নাল','লেজার','ফিন্যান্স']], ['ফিন্যান্স','💳',['বিনিয়োগ','ব্যাংকিং','বাজেট']], ['প্রোগ্রামিং','⌨️',['Python','JavaScript','অ্যালগরিদম']], ['IELTS','🌐',['Speaking','Writing','Reading']], ['ভর্তি প্রস্তুতি','🎯',['গণিত','ইংরেজি','সাধারণ জ্ঞান']]
];
const makeUser = (id: string, email: string, role: Role, name: string): User => ({ id, email, role, name, passwordHash: passwordHash('demo123'), createdAt: now(), active: true, profile: {} });

type PracticeQuestion = { topic: string; text: string; options: string[]; answer: number; explanation: string };

const practiceQuestions: Record<string, PracticeQuestion[]> = {
  গণিত: [
    { topic: 'বীজগণিত', text: '3x − 5 = 10 হলে x-এর মান কত?', options: ['৩', '৪', '৫', '৬'], answer: 2, explanation: '৩x = ১৫, তাই x = ৫।' },
    { topic: 'ক্যালকুলাস', text: 'f(x) = x² হলে f′(x) কত?', options: ['x', '2x', 'x²', '2'], answer: 1, explanation: 'ঘাতের সূত্র অনুযায়ী x²-এর অন্তরক 2x।' },
    { topic: 'জ্যামিতি', text: 'ত্রিভুজের দুটি কোণ ৫০° ও ৬০° হলে তৃতীয় কোণ কত?', options: ['৫০°', '৬০°', '৭০°', '৮০°'], answer: 2, explanation: 'ত্রিভুজের তিন কোণের যোগফল ১৮০°; তাই তৃতীয় কোণ ৭০°।' }
  ],
  পদার্থবিজ্ঞান: [
    { topic: 'বিদ্যুৎ', text: '২ Ω ও ৩ Ω রোধ সিরিজে যুক্ত হলে সমতুল্য রোধ কত?', options: ['১ Ω', '৫ Ω', '৬ Ω', '০.৫ Ω'], answer: 1, explanation: 'সিরিজ সংযোগে রোধ যোগ হয়: ২ + ৩ = ৫ Ω।' },
    { topic: 'গতিবিদ্যা', text: 'স্থির অবস্থা থেকে ২ m/s² ত্বরণে ৩ সেকেন্ড চললে শেষ বেগ কত?', options: ['৩ m/s', '৫ m/s', '৬ m/s', '৯ m/s'], answer: 2, explanation: 'v = u + at; এখানে u = ০, তাই v = ২ × ৩ = ৬ m/s।' },
    { topic: 'তরঙ্গ', text: 'একটি তরঙ্গের কম্পাঙ্ক ৫ Hz হলে পর্যায়কাল কত?', options: ['০.১ s', '০.২ s', '২ s', '৫ s'], answer: 1, explanation: 'পর্যায়কাল T = 1/f; তাই T = 1/5 = ০.২ s।' }
  ],
  রসায়ন: [
    { topic: 'জৈব রসায়ন', text: 'ইথানলের কার্যকরী মূলক কোনটি?', options: ['–OH', '–COOH', '–CHO', '–NH₂'], answer: 0, explanation: 'ইথানল একটি অ্যালকোহল; এর কার্যকরী মূলক হাইড্রক্সিল (–OH)।' },
    { topic: 'পর্যায় সারণি', text: 'সোডিয়াম (Na) পর্যায় সারণির কোন গ্রুপে থাকে?', options: ['গ্রুপ ১', 'গ্রুপ ২', 'গ্রুপ ১৭', 'গ্রুপ ১৮'], answer: 0, explanation: 'সোডিয়াম ক্ষার ধাতু; এটি পর্যায় সারণির গ্রুপ ১-এ অবস্থিত।' },
    { topic: 'মোল', text: '১৮ g পানিতে কত মোল H₂O থাকে? (মোলার ভর ১৮ g/mol)', options: ['০.৫ mol', '১ mol', '২ mol', '১৮ mol'], answer: 1, explanation: 'মোল সংখ্যা = ভর ÷ মোলার ভর = ১৮ ÷ ১৮ = ১ mol।' }
  ],
  জীববিজ্ঞান: [
    { topic: 'কোষ', text: 'কোষে ATP তৈরির প্রধান স্থান কোনটি?', options: ['রাইবোজোম', 'মাইটোকন্ড্রিয়া', 'গলজি বডি', 'লাইসোজোম'], answer: 1, explanation: 'কোষীয় শ্বসনের মাধ্যমে মাইটোকন্ড্রিয়ায় অধিকাংশ ATP উৎপন্ন হয়।' },
    { topic: 'জিনতত্ত্ব', text: 'DNA-তে অ্যাডেনিন (A)-এর সঙ্গে কোন ক্ষারক জোড়া বাঁধে?', options: ['গুয়ানিন (G)', 'সাইটোসিন (C)', 'থাইমিন (T)', 'ইউরাসিল (U)'], answer: 2, explanation: 'DNA-তে A-এর পরিপূরক ক্ষারক হলো T।' },
    { topic: 'প্রাণিবিজ্ঞান', text: 'মাছ পানিতে শ্বাস নেওয়ার জন্য কোন অঙ্গ ব্যবহার করে?', options: ['ফুসফুস', 'ফুলকা', 'ত্বক', 'ট্রাকিয়া'], answer: 1, explanation: 'মাছ ফুলকার সাহায্যে পানি থেকে দ্রবীভূত অক্সিজেন গ্রহণ করে।' }
  ],
  ইংরেজি: [
    { topic: 'গ্রামার', text: 'She ___ to school every day.', options: ['go', 'goes', 'going', 'gone'], answer: 1, explanation: 'Simple present tense-এ third-person singular subject-এর সঙ্গে verb-এ s/es যোগ হয়।' },
    { topic: 'রাইটিং', text: 'একটি অনুচ্ছেদের topic sentence-এর কাজ কী?', options: ['মূল ধারণা জানানো', 'উদাহরণ তালিকাভুক্ত করা', 'অনুচ্ছেদ শেষ করা', 'শিরোনাম পুনরাবৃত্তি করা'], answer: 0, explanation: 'Topic sentence অনুচ্ছেদের কেন্দ্রীয় ধারণা বা বক্তব্য তুলে ধরে।' },
    { topic: 'স্পিকিং', text: 'কোন বাক্যটি ভদ্রভাবে কিছু আবার বলতে অনুরোধ করে?', options: ['What?', 'Could you please repeat that?', 'Say it again!', 'Speak louder.'], answer: 1, explanation: '“Could you please…” দিয়ে অনুরোধ করলে কথাটি ভদ্র ও স্পষ্ট শোনায়।' }
  ],
  বাংলা: [
    { topic: 'ব্যাকরণ', text: '“রহিম বই পড়ে” বাক্যে ক্রিয়া কোনটি?', options: ['রহিম', 'বই', 'পড়ে', 'বাক্য'], answer: 2, explanation: 'যে শব্দ দিয়ে কাজ করা বোঝায়, সেটিই ক্রিয়া; এখানে “পড়ে” কাজটি বোঝায়।' },
    { topic: 'সাহিত্য', text: '“চাঁদের মতো মুখ” বাক্যে উপমেয় কোনটি?', options: ['চাঁদ', 'মুখ', 'মতো', 'আকাশ'], answer: 1, explanation: 'যার সঙ্গে তুলনা করা হয়, সেটি উপমেয়; এখানে মুখকে চাঁদের সঙ্গে তুলনা করা হয়েছে।' },
    { topic: 'রচনা', text: 'একটি প্রবন্ধের ভূমিকার প্রধান কাজ কী?', options: ['বিষয়ের পরিচয় দেওয়া', 'সব তথ্যের তালিকা দেওয়া', 'উপসংহার লেখা', 'উৎসের নাম লেখা'], answer: 0, explanation: 'ভূমিকা পাঠককে প্রবন্ধের বিষয় ও মূল প্রসঙ্গের সঙ্গে পরিচিত করে।' }
  ],
  আইসিটি: [
    { topic: 'ডেটাবেজ', text: 'ডেটাবেজের primary key-এর প্রধান কাজ কী?', options: ['প্রতিটি রেকর্ডকে আলাদাভাবে শনাক্ত করা', 'টেবিল সাজানো', 'ছবি সংরক্ষণ করা', 'ডেটা মুছে ফেলা'], answer: 0, explanation: 'Primary key প্রতিটি রেকর্ডের জন্য স্বতন্ত্র পরিচয় নিশ্চিত করে।' },
    { topic: 'ওয়েব ডিজাইন', text: 'একটি ওয়েব পেজের মূল কাঠামো তৈরিতে কোন ভাষা ব্যবহৃত হয়?', options: ['HTML', 'CSS', 'SQL', 'PNG'], answer: 0, explanation: 'HTML ওয়েব পেজের কাঠামো ও কনটেন্ট নির্ধারণ করে।' },
    { topic: 'সংখ্যা পদ্ধতি', text: 'দশমিক ১০-এর বাইনারি রূপ কোনটি?', options: ['১০০১', '১০১০', '১১১০', '১০০০'], answer: 1, explanation: 'দশমিক ১০ = ৮ + ২; তাই বাইনারিতে এর রূপ ১০১০।' }
  ],
  হিসাববিজ্ঞান: [
    { topic: 'জার্নাল', text: 'লেনদেন প্রথমে তারিখের ক্রমানুসারে কোথায় লেখা হয়?', options: ['জার্নালে', 'লেজারে', 'রেওয়ামিলে', 'আয় বিবরণীতে'], answer: 0, explanation: 'জার্নালে লেনদেন প্রথমে তারিখ অনুযায়ী নথিভুক্ত করা হয়।' },
    { topic: 'লেজার', text: 'লেজারে লেনদেন কীভাবে সাজানো হয়?', options: ['হিসাবের খাত অনুযায়ী', 'তারিখ ছাড়া', 'শুধু নগদে', 'বর্ণানুক্রমে'], answer: 0, explanation: 'জার্নাল থেকে লেনদেন সংশ্লিষ্ট পৃথক হিসাবের খাতে স্থানান্তর করা হয়।' },
    { topic: 'ফিন্যান্স', text: 'মৌলিক হিসাব সমীকরণ কোনটি?', options: ['সম্পদ = দায় + মালিকানা স্বত্ব', 'সম্পদ = আয় − ব্যয়', 'দায় = আয় + ব্যয়', 'মূলধন = সম্পদ + দায়'], answer: 0, explanation: 'মৌলিক হিসাব সমীকরণ হলো সম্পদ = দায় + মালিকানা স্বত্ব।' }
  ],
  ফিন্যান্স: [
    { topic: 'বিনিয়োগ', text: 'বিভিন্ন খাতে বিনিয়োগ ছড়িয়ে রাখার প্রধান সুবিধা কী?', options: ['ঝুঁকি বণ্টন করা', 'নিশ্চিত মুনাফা পাওয়া', 'কর শূন্য করা', 'ব্যয় বাড়ানো'], answer: 0, explanation: 'বিভিন্ন সম্পদে বিনিয়োগ করলে একটি খাতের ক্ষতির প্রভাব কমতে পারে।' },
    { topic: 'ব্যাংকিং', text: '২,০০০ টাকায় বার্ষিক ৫% সরল সুদে ২ বছরে সুদ কত?', options: ['১০০ টাকা', '২০০ টাকা', '২৫০ টাকা', '৪০০ টাকা'], answer: 1, explanation: 'সরল সুদ = মূলধন × হার × সময় ÷ ১০০ = ২,০০০ × ৫ × ২ ÷ ১০০ = ২০০ টাকা।' },
    { topic: 'বাজেট', text: 'মাসিক বাজেটে উদ্বৃত্ত থাকে কখন?', options: ['আয় ব্যয়ের চেয়ে বেশি হলে', 'ব্যয় আয় ছাড়ালে', 'আয় ও ব্যয় দুটিই শূন্য হলে', 'ঋণ বাড়লে'], answer: 0, explanation: 'আয় থেকে ব্যয় বাদ দিলে ধনাত্মক পরিমাণ থাকলে বাজেটে উদ্বৃত্ত হয়।' }
  ],
  প্রোগ্রামিং: [
    { topic: 'Python', text: 'Python-এ print(2 + 3) চালালে কী দেখা যাবে?', options: ['23', '5', '2 + 3', 'ত্রুটি'], answer: 1, explanation: 'যোগের ফল ৫; print সেই মানটি দেখায়।' },
    { topic: 'JavaScript', text: 'JavaScript-এ মান ও ধরন—দুটিই কঠোরভাবে তুলনা করতে কোন অপারেটর ব্যবহৃত হয়?', options: ['=', '==', '===', '=>'], answer: 2, explanation: '=== মানের পাশাপাশি data type-ও তুলনা করে।' },
    { topic: 'অ্যালগরিদম', text: 'একটি কার্যকর অ্যালগরিদমে কী থাকা জরুরি?', options: ['সসীম ও স্পষ্ট ধাপ', 'অসীম লুপ', 'শুধু ছবি', 'একাধিক অস্পষ্ট নির্দেশ'], answer: 0, explanation: 'অ্যালগরিদমে সমস্যা সমাধানের স্পষ্ট ও সসীম ধাপ থাকতে হয়।' }
  ],
  IELTS: [
    { topic: 'Speaking', text: 'IELTS Speaking Part 2-তে প্রার্থী সাধারণত কতক্ষণ কথা বলেন?', options: ['২০–৩০ সেকেন্ড', '১–২ মিনিট', '৫ মিনিট', '১০ মিনিট'], answer: 1, explanation: 'Part 2-তে প্রস্তুতির পর সাধারণত ১–২ মিনিটের একটি দীর্ঘ উত্তর দিতে হয়।' },
    { topic: 'Writing', text: 'IELTS Academic Writing Task 1-এ সাধারণত কী করতে হয়?', options: ['তথ্যচিত্র বা গ্রাফের সারাংশ লেখা', 'ব্যক্তিগত চিঠি লেখা', 'শুধু মতামত দেওয়া', 'গল্প লেখা'], answer: 0, explanation: 'Academic Task 1-এ গ্রাফ, চার্ট বা চিত্রের প্রধান বৈশিষ্ট্য সংক্ষেপে বর্ণনা করা হয়।' },
    { topic: 'Reading', text: 'কোনো অনুচ্ছেদের মূল বক্তব্য দ্রুত খুঁজতে কোন কৌশলটি কাজে লাগে?', options: ['Skimming', 'শব্দে শব্দে অনুবাদ', 'শুধু শেষ লাইন পড়া', 'বানান মুখস্থ করা'], answer: 0, explanation: 'Skimming-এ দ্রুত পড়ে অনুচ্ছেদের সামগ্রিক ধারণা বোঝা হয়।' }
  ],
  'ভর্তি প্রস্তুতি': [
    { topic: 'গণিত', text: '২৫০-এর ২০% কত?', options: ['২৫', '৪০', '৫০', '৭৫'], answer: 2, explanation: '২৫০ × ২০ ÷ ১০০ = ৫০।' },
    { topic: 'ইংরেজি', text: '“Go” verb-এর past simple form কোনটি?', options: ['Goed', 'Gone', 'Went', 'Going'], answer: 2, explanation: '“Go”-এর past simple form হলো “went”; “gone” হলো past participle।' },
    { topic: 'সাধারণ জ্ঞান', text: 'বাংলাদেশের স্বাধীনতা দিবস কোন তারিখে পালিত হয়?', options: ['২১ ফেব্রুয়ারি', '২৬ মার্চ', '১৬ ডিসেম্বর', '১৪ এপ্রিল'], answer: 1, explanation: 'বাংলাদেশের স্বাধীনতা দিবস ২৬ মার্চ।' }
  ]
};

export function createDemoProblems() {
  const deadline = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  return [
    { id: 'problem-demo-physics', studentId: 'student-2', title: 'নিউটনের গতিসূত্রের অঙ্কে আটকে গেছি', description: 'Free-body diagram এঁকে বলের দিক বুঝতে এবং দ্বিতীয় গতিসূত্র ব্যবহার করে অঙ্ক সমাধান করতে সাহায্য চাই।', subject: 'পদার্থবিজ্ঞান', topic: 'গতিবিদ্যা', budget: 500, deadline: deadline(2), status: 'OPEN' as const, createdAt: now() },
    { id: 'problem-demo-chemistry', studentId: 'student-3', title: 'জৈব রসায়নের বিক্রিয়াগুলো গুছিয়ে শিখতে চাই', description: 'বিভিন্ন বিক্রিয়ার ধাপ ও রূপান্তর মনে রাখতে সমস্যা হচ্ছে। সহজ কৌশল, উদাহরণ এবং অনুশীলনীসহ বুঝতে চাই।', subject: 'রসায়ন', topic: 'জৈব রসায়ন', budget: 650, deadline: deadline(3), status: 'OPEN' as const, createdAt: now() },
    { id: 'problem-demo-english', studentId: 'student-4', title: 'ইংরেজি paragraph-এ tense ও sentence structure ঠিক করতে চাই', description: 'লেখার সময় tense বদলে যায় এবং বাক্য গঠন দুর্বল থাকে। একটি লেখা দেখে ভুলগুলো বুঝিয়ে অনুশীলন করাতে পারবেন?', subject: 'ইংরেজি', topic: 'রাইটিং', budget: 400, deadline: deadline(4), status: 'OPEN' as const, createdAt: now() }
  ];
}

export function createDemoState(): AppState {
  const state: AppState = { users: [], subjects: [], teachers: [], gigs: [], gigDrafts: [], gigOffers: [], gigVersions: [], gigAnalytics: [], gigModeration: [], bookings: [], payments: [], ledger: [], messages: [], notifications: [], reviews: [], questions: [], exams: [], attempts: [], favorites: [], problems: [], offers: [], parentChildren: [], reports: [], audit: [] };
  state.subjects = subjects.map(([name, icon, topics], i) => ({ id: `sub-${i + 1}`, name: name as string, icon: icon as string, topics: topics as string[] }));
  state.users.push(makeUser('admin-1', 'admin@demo.local', 'ADMIN', 'প্ল্যাটফর্ম অ্যাডমিন'));
  state.users.push(makeUser('demo-1', 'demo@demo.local', 'STUDENT', 'শিক্ষার্থী অ্যাকাউন্ট'));
  for (let i = 1; i <= 20; i++) state.users.push(makeUser(`student-${i}`, i === 1 ? 'student@demo.local' : `student${i}@demo.local`, 'STUDENT', `শিক্ষার্থী ${i}`));
  for (let i = 1; i <= 10; i++) state.users.push(makeUser(`parent-${i}`, i === 1 ? 'parent@demo.local' : `parent${i}@demo.local`, 'PARENT', `অভিভাবক ${i}`));
  bnNames.forEach((name, i) => {
    const n = i + 1; const subject = state.subjects[i % state.subjects.length];
    const userId = `teacher-${n}`; state.users.push(makeUser(userId, n === 1 ? 'teacher@demo.local' : `teacher${n}@demo.local`, 'TEACHER', name));
    const teacher = { id: userId, userId, headline: `${subject.name} সহজ করে শেখানোর অভিজ্ঞ শিক্ষক`, bio: `আমি ${name}। ${subject.name} সহজ ভাষায় বুঝতে উদাহরণ, ছোট ছোট ধাপ এবং নিয়মিত অনুশীলনের মাধ্যমে শেখার অগ্রগতি গড়ে তুলি।`, education: n % 2 ? 'স্নাতকোত্তর' : 'স্নাতক', institution: n % 2 ? 'ঢাকা বিশ্ববিদ্যালয়' : 'বুয়েট', subjects: [subject.name], skills: subject.topics, experienceYears: 2 + (i % 11), languages: ['বাংলা', ...(i % 3 ? ['ইংরেজি'] : [])], location: i % 2 ? 'ঢাকা' : 'চট্টগ্রাম', hourlyRate: 350 + (i % 6) * 100, sessionPrice: 450 + (i % 8) * 125, rating: Number((4.2 + (i % 8) / 10).toFixed(1)), reviewCount: 5 + (i * 3), classes: 20 + i * 9, students: 8 + i * 4, verified: i % 4 !== 3, verificationStatus: (i % 4 === 3 ? 'PENDING' : 'APPROVED') as 'PENDING' | 'APPROVED', level: i > 14 ? 'সেরা শিক্ষক' : i > 6 ? 'লেভেল ২' : 'যাচাইকৃত শিক্ষক', availability: { 'শনিবার': ['১০:০০','১৪:০০','১৯:০০'], 'সোমবার': ['১০:০০','১৬:০০','২০:০০'], 'বুধবার': ['১১:০০','১৮:০০'] }, blockedDates: [], demoUrl: '', profileViews: 40 + i * 17, gigViews: 60 + i * 22, responseRate: 90 + (i % 10), cancellationRate: i % 4, isLive: i % 3 !== 0, lastSeenAt: now() };
    state.teachers.push(teacher);
    for (let g = 1; g <= 3; g++) { const topic = subject.topics[(g - 1) % subject.topics.length]; state.gigs.push({ id: `gig-${n}-${g}`, teacherId: userId, title: g === 1 ? `${subject.name} ${topic}: ধারণার ভিত্তি মজবুত করুন` : g === 2 ? `${subject.name} ${topic}: অনুশীলন ও বোর্ড প্রশ্ন` : `${subject.name} ${topic}: পরীক্ষা প্রস্তুতি ও মডেল টেস্ট`, description: g === 1 ? `মূল ধারণা থেকে শুরু করে ধাপে ধাপে ${topic} বুঝুন। উদাহরণ, অনুশীলন ও ক্লাস-পরবর্তী নোটে তৈরি করুন পরিষ্কার ভিত্তি।` : g === 2 ? `গুরুত্বপূর্ণ কৌশল শিখে নির্বাচিত ${topic} প্রশ্ন নিজে সমাধান করুন। প্রতিটি ক্লাসে প্রশ্নোত্তর ও শেখার অগ্রগতি দেখা হবে।` : `পরীক্ষার আগে ${topic} গুছিয়ে রিভিশন করুন। সময় ধরে মডেল টেস্ট, ভুল বিশ্লেষণ ও ব্যক্তিগত ফিডব্যাক থাকবে।`, subject: subject.name, topic, level: g === 1 ? 'বেসিক' : g === 2 ? 'HSC' : subject.name === 'IELTS' ? 'IELTS প্রস্তুতি' : ['প্রোগ্রামিং','ফিন্যান্স','হিসাববিজ্ঞান'].includes(subject.name) ? 'মধ্যম' : 'ভর্তি প্রস্তুতি', language: 'বাংলা', tags: [subject.name, topic, 'লাইভ ক্লাস'], packages: [{ id: `pkg-${n}-${g}-basic`, name: 'বেসিক', classes: 1, duration: 60, price: teacher.hourlyRate, features: ['১টি লাইভ ক্লাস','ক্লাস নোট'] }, { id: `pkg-${n}-${g}-standard`, name: 'স্ট্যান্ডার্ড', classes: 5, duration: 60, price: teacher.hourlyRate * 4, features: ['৫টি লাইভ ক্লাস','ক্লাস নোট','ছোট পরীক্ষা'] }, { id: `pkg-${n}-${g}-premium`, name: 'প্রিমিয়াম', classes: 10, duration: 60, price: teacher.hourlyRate * 7, features: ['১০টি লাইভ ক্লাস','ক্লাস নোট','পরীক্ষা ও ফিডব্যাক'] }], demoUrl: teacher.demoUrl, includes: ['লাইভ ইন্টারঅ্যাক্টিভ ক্লাস','ক্লাস-পরবর্তী নোট','অনুশীলনের দিকনির্দেশনা'], requirements: 'খাতা, কলম এবং শেখার আগ্রহ সঙ্গে রাখুন।', faqs: [{ q: 'ক্লাসটি কার জন্য?', a: 'নির্বাচিত স্তরের সকল শিক্ষার্থীর জন্য।' }], active: true, createdAt: now() }); }
  });
  for (let i = 1; i <= 120; i++) {
    const subject = state.subjects[i % state.subjects.length];
    const teacherId = state.teachers[i % state.teachers.length].id;
    const variant = Math.floor((i - 1) / state.subjects.length) % 3;
    const question = practiceQuestions[subject.name]?.[variant];
    if (!question) continue;
    state.questions.push({ id: 'q-' + i, teacherId, subject: subject.name, topic: question.topic, difficulty: ['সহজ','মাঝারি','কঠিন'][variant], text: question.text, options: question.options, answer: question.answer, explanation: question.explanation, marks: 1, tags: [subject.name, question.topic] });
  }
  state.subjects.slice(0, 3).forEach((subject, index) => {
    const qs = state.questions.filter(question => question.subject === subject.name).slice(0, 10);
    state.exams.push({ id: 'exam-' + (index + 1), teacherId: 'teacher-1', title: subject.name + ' বিষয়ভিত্তিক অনুশীলনী', subject: subject.name, topic: 'মিশ্র অনুশীলন', duration: 20, passMark: 50, questionIds: qs.map(question => question.id), active: true });
  });
  for (let i = 1; i <= 120; i++) { const teacher = state.teachers[i % state.teachers.length]; state.reviews.push({ id: 'review-' + i, bookingId: 'old-booking-' + i, studentId: 'student-' + ((i % 20) + 1), teacherId: teacher.id, rating: (i % 5) + 1, comment: 'নমুনা মতামত: বিষয়গুলো ধাপে ধাপে বুঝিয়েছেন এবং অনুশীলনে সহায়তা করেছেন।', createdAt: now() }); }
  const gig = state.gigs[0]; const pkg = gig.packages[1]; const booking = { id: 'booking-1', studentId: 'student-1', teacherId: 'teacher-1', gigId: gig.id, packageId: pkg.id, date: new Date(Date.now() + 86400000).toISOString().slice(0,10), time: '১৬:০০', price: pkg.price, status: 'CONFIRMED' as const, history: [{ status: 'PENDING' as const, at: now(), note: 'বুকিং তৈরি হয়েছে' }, { status: 'CONFIRMED' as const, at: now(), note: 'পরীক্ষামূলক অর্থপ্রদান সম্পন্ন হয়েছে' }], createdAt: now(), notes: 'আগামী ক্লাসে গতির সমীকরণ অনুশীলন করা হবে।', attendance: { teacher: true, student: true } }; state.bookings.push(booking);
  state.bookings.push({ id: 'booking-2', studentId: 'student-2', teacherId: 'teacher-1', gigId: gig.id, packageId: pkg.id, date: new Date().toISOString().slice(0,10), time: 'এখন', price: pkg.price, status: 'IN_PROGRESS' as const, history: [{ status: 'CONFIRMED' as const, at: now(), note: 'ক্লাস শুরু হয়েছে' }, { status: 'IN_PROGRESS' as const, at: now(), note: 'শিক্ষক ও শিক্ষার্থী ক্লাসরুমে আছেন' }], createdAt: now(), attendance: { teacher: true, student: true } });
  state.payments.push({ id: 'payment-demo-1', bookingId: booking.id, studentId: booking.studentId, amount: booking.price, status: 'PAID', transactionId: 'SHK-2026-0001', createdAt: now() });
  state.ledger.push({ id: 'ledger-demo-1', userId: booking.teacherId, type: 'PENDING_EARNING', amount: Math.round(booking.price * .8), ref: booking.id, note: 'নিশ্চিত বুকিং থেকে প্রাপ্য', createdAt: now() }, { id: 'ledger-demo-2', userId: booking.teacherId, type: 'PLATFORM_FEE', amount: -Math.round(booking.price * .2), ref: booking.id, note: 'প্ল্যাটফর্ম কমিশন', createdAt: now() });
  state.messages.push({ id: 'message-demo-1', conversationId: 'student-1:teacher-1', senderId: 'teacher-1', receiverId: 'student-1', body: 'স্বাগতম! ক্লাসের আগে আপনার প্রশ্নগুলো পাঠাতে পারেন।', createdAt: now() });
  state.notifications.push({ id: 'notification-demo-1', userId: 'student-1', type: 'BOOKING', title: 'আপনার বুকিং নিশ্চিত হয়েছে', body: 'আগামীকাল বিকাল ৪টায় আপনার ক্লাস আছে।', href: '/booking-1', createdAt: now() }, { id: 'notification-demo-2', userId: 'teacher-1', type: 'PAYMENT', title: 'নতুন বুকিংয়ের আয় যোগ হয়েছে', body: 'নিশ্চিত বুকিংয়ের প্রাপ্য অর্থ আপনার হিসাবে যোগ হয়েছে।', href: '/dashboard', createdAt: now() });
  state.parentChildren.push({ id: 'pc-1', parentId: 'parent-1', childId: 'student-1', createdAt: now() });
  state.problems.push({ id: 'problem-1', studentId: 'student-1', title: 'ক্যালকুলাসের সীমা বুঝতে পারছি না', description: 'এই অধ্যায়ের কয়েকটি অঙ্ক ধাপে ধাপে বুঝতে চাই।', subject: 'গণিত', topic: 'ক্যালকুলাস', budget: 400, deadline: new Date(Date.now() + 172800000).toISOString().slice(0,10), status: 'OPEN', createdAt: now() }, ...createDemoProblems());
  return state;
}
export const id = (prefix: string) => `${prefix}-${randomUUID()}`;
