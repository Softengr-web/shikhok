# শিখক — সম্পূর্ণ লোকাল ডেমো

শিখক হলো বাংলা ভাষার শিক্ষক মার্কেটপ্লেস ও শেখার প্ল্যাটফর্ম। এটি সম্পূর্ণ বিনামূল্যে নিজের Windows কম্পিউটারে চালানো যায়। পেমেন্ট, ভিডিও ক্লাস, রেকর্ডিং ও নোটিফিকেশন সবই **লোকাল ডেমো**; কোনো আসল অর্থ বা বাইরের পেইড API ব্যবহার হয় না।

## সবচেয়ে সহজে চালান

প্রথমে [Node.js 20 বা তার নতুন LTS সংস্করণ](https://nodejs.org/) ইনস্টল করুন। PowerShell-এ এই ফোল্ডারে গিয়ে চালান:

```powershell
npm.cmd install
npm.cmd run db:setup
npm.cmd run dev
```

তারপর ব্রাউজারে `http://localhost:5173` খুলুন। API সার্ভার চলবে `http://localhost:3001`-এ। PowerShell-এর execution policy-তে `npm` আটকে গেলে `npm.cmd` ব্যবহার করুন, যেমন উপরে দেওয়া হয়েছে।

## ডেমো অ্যাকাউন্ট

সব অ্যাকাউন্টের পাসওয়ার্ড: `demo123`

| ভূমিকা | ইমেইল |
|---|---|
| সক্রিয় ডেমো শিক্ষার্থী | `demo@demo.local` |
| শিক্ষার্থী | `student@demo.local` |
| শিক্ষক | `teacher@demo.local` |
| অভিভাবক | `parent@demo.local` |
| অ্যাডমিন | `admin@demo.local` |

## কী কী পরীক্ষা করবেন

1. শিক্ষার্থী অ্যাকাউন্টে লগইন করে শিক্ষক খুঁজুন, তুলনা করুন এবং একটি গিগ খুলুন।
2. প্যাকেজ, তারিখ ও সময় নির্বাচন করুন, তারপর **ডেমো পেমেন্ট সম্পন্ন করুন**। রসিদ ও নিশ্চিত বুকিং দেখুন।
3. বুকিং থেকে লোকাল ক্লাসরুমে যান: ক্যানভাস হোয়াইটবোর্ড, চ্যাট, নোট, ক্যামেরা/মাইক ও MediaRecorder ব্যবহার করুন। ক্যামেরা অনুমতি ব্রাউজার চাইবে।
4. পরীক্ষা থেকে MCQ দিন; নম্বর সার্ভারে হিসাব হয়।
5. শিক্ষক অ্যাকাউন্টে লগইন করে গিগ, প্রোফাইল, ক্লাস নোট ও ডেমো ওয়ালেট দেখুন।
6. অভিভাবক অ্যাকাউন্টে সন্তানের ক্লাস ও পরীক্ষার সারাংশ দেখুন।
7. অ্যাডমিন অ্যাকাউন্টে অপেক্ষমাণ শিক্ষককে অনুমোদন বা প্রত্যাখ্যান করুন।

## দরকারি কমান্ড

```powershell
npm.cmd run dev          # ডেভেলপমেন্ট সার্ভার
npm.cmd run build        # প্রোডাকশন বিল্ড
npm.cmd run start        # বিল্ড চালু করা
npm.cmd run typecheck    # TypeScript পরীক্ষা
npm.cmd run lint         # ESLint পরীক্ষা
npm.cmd run test         # ব্যবসায়িক লজিকের স্বয়ংক্রিয় পরীক্ষা
npm.cmd run test:e2e     # লোকাল ফ্লো পরীক্ষার এন্ট্রি-পয়েন্ট
npm.cmd run db:setup     # সিনথেটিক ডেমো ডেটা নতুন করে তৈরি
npm.cmd run db:reset     # ডেটা মুছে নতুন ডেমো ডেটা তৈরি
```

`db:setup` চালালে `data/shikhok-demo.json`-এ নতুন সিনথেটিক ডেটা হয়। এটি Git-এ রাখা হয় না। তাই রিসেট দিলে আপনার লোকাল বুকিং/বার্তা মুছে যাবে।

## PostgreSQL ও Prisma

এই শূন্য-সেটআপ ডেমো মেশিনে PostgreSQL ইনস্টল না থাকলেও চালানোর জন্য atomic লোকাল JSON store ব্যবহার করে। তবে সম্পূর্ণ সম্পর্ক, foreign key, index ও enum-সহ production PostgreSQL Prisma মডেল [prisma/schema.prisma](prisma/schema.prisma)-তে আছে। PostgreSQL চালু করে `.env.example` থেকে `.env` বানিয়ে `DATABASE_URL` ঠিক করার পর:

```powershell
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:studio
```

বর্তমান লোকাল ডেমো সার্ভিসের persistence adapter-টি [server/store.ts](server/store.ts); PostgreSQL deployment-এর সময় সেই adapter-এ Prisma repository যোগ করতে হবে। এতে বর্তমান business services বা UI বদলাতে হবে না। বিস্তারিত [লোকাল ডেভেলপমেন্ট নির্দেশনা](docs/local-development.md)-এ আছে।

## নিরাপত্তা ও সীমা

- পাসওয়ার্ড `scrypt` দিয়ে হ্যাশ করা হয়; সেশন cookie `HttpOnly` ও `SameSite=Lax`।
- মূল্য, পেমেন্ট, বুকিং status, পরীক্ষা নম্বর ও যাচাইকরণ সার্ভারে যাচাই হয়।
- ডেমো রেকর্ডিং ব্রাউজারেই তৈরি হয়; ভিডিও ফাইল সার্ভারে আপলোড করা হয় না।
- এই সংস্করণটি localhost-এ চালানোর জন্য, ইন্টারনেটে প্রকাশ করার জন্য নয়। প্রকাশের আগে PostgreSQL adapter, CSRF policy, rate limit, HTTPS ও আসল storage provider যোগ করুন।

আরও নকশা ও API তথ্য: [docs](docs)।
