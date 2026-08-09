# নিরাপত্তা

পাসওয়ার্ড salted `scrypt` hash; raw password database-এ থাকে না। API route role check করে এবং entity ownership যাচাই করে। validation helper text length, required field, role, package, date, rating ও monetary value সার্ভারে যাচাই করে।

লোকাল ব্যবহারেও `.env` ও demo data প্রকাশ করবেন না। Production-এ HTTPS secure cookie, CSRF token, rate limiting, structured audit storage, virus scan, private object store এবং CSP যুক্ত করা প্রয়োজন।
