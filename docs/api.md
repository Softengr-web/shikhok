# লোকাল API

সব route `/api` দিয়ে শুরু এবং JSON `{ ok, data }` ফেরত দেয়। protected route HttpOnly `shikhok_session` cookie চায়।

| ক্ষেত্র | উদাহরণ route |
|---|---|
| Auth | `POST /auth/login`, `/auth/register`, `/auth/logout`, `GET /auth/me` |
| Marketplace | `GET /teachers`, `/matches`, `/teachers/:id`, `/gigs/:id` |
| Booking | `POST /bookings`, `POST /bookings/:id/pay`, `POST /bookings/:id/status` |
| Learning | `GET /exams`, `GET /exams/:id`, `POST /exams/:id/submit` |
| Communication | `GET/POST /messages/:userId`, `GET /notifications` |
| Teacher/Admin | `PUT /teacher/profile`, `POST /teacher/gigs`, `GET /wallet`, `POST /admin/teachers/:id/verification` |

কোনো client দেওয়া price, score, verification decision অথবা booking status বিশ্বাস করা হয় না।
