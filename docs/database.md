# ডেটাবেস

`prisma/schema.prisma`-তে User, profile, Gig, Booking, Payment, Transaction, Wallet, Classroom, Message, Exam, Course, Problem, moderation ও audit-এর normalised PostgreSQL schema আছে। unique index দিয়ে duplicate review, enrollment, favorite ও payment reference আটকানো হয়েছে; teacher/time index বুকিং query দ্রুত করে।

লোকাল demo store একই business entities JSON-এ রাখে এবং write-এর সময় temporary file rename করে। এটি single-process localhost ব্যবহারের জন্য। PostgreSQL production migration-এ booking slot conflict আরও শক্ত করতে transaction ও exclusion/locking policy ব্যবহার করুন।
