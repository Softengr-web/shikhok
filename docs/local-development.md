# লোকাল ডেভেলপমেন্ট

1. Node.js LTS ইনস্টল করুন।
2. `.env.example` কপি করে `.env` করুন (লোকাল ডেমোর জন্য বাধ্যতামূলক নয়)।
3. `npm.cmd install`
4. `npm.cmd run db:setup`
5. `npm.cmd run dev`
6. `http://localhost:5173` খুলুন।

PostgreSQL ব্যবহার করতে PostgreSQL Community Edition ইনস্টল করে `createdb shikhok` চালান, `.env`-এ URL দিন, তারপর `npm.cmd run db:generate` ও `npm.cmd run db:migrate` চালান। এই project-এর out-of-box runtime এখনও local demo adapter ব্যবহার করে, তাই PostgreSQL ছাড়াও acceptance flow পরীক্ষা করা যায়।
