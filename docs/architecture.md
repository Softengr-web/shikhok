# আর্কিটেকচার

Vite/React single-page client `5173` পোর্টে চলে এবং Express API `3001` পোর্টে proxy হয়। সব auth ও গুরুত্বপূর্ণ business rule Express-এ চলে।

```text
React UI → /api → Express route → service → LocalStore (atomic JSON)
                                      └→ Prisma/PostgreSQL schema (production target)
```

`server/services.ts` payment, matching, booking, exam এবং authorization-এর domain logic রাখে। ভবিষ্যতে `LocalStore`-এর জায়গায় Prisma repository বসালেই provider বদলানো যাবে। Local payment, video, recording ও storage browser/server-native implementation; কোনো AI provider নেই।
