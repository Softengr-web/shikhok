export type Role = 'STUDENT' | 'TEACHER' | 'PARENT' | 'ADMIN' | 'SUPER_ADMIN';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'DISPUTED' | 'REFUNDED';

export interface User {
  id: string; email: string; passwordHash: string; role: Role; name: string;
  phone?: string; createdAt: string; active: boolean; profile: Record<string, unknown>;
}
export interface Subject { id: string; name: string; icon: string; topics: string[]; }
export interface Teacher {
  id: string; userId: string; headline: string; bio: string; education: string; institution: string;
  subjects: string[]; skills: string[]; experienceYears: number; languages: string[]; location: string;
  hourlyRate: number; rating: number; reviewCount: number; classes: number; students: number;
  verified: boolean; verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  level: string; availability: Record<string, string[]>; blockedDates: string[]; demoUrl: string;
  profileViews: number; gigViews: number; responseRate: number; cancellationRate: number;
}
export interface GigPackage { id: string; name: string; classes: number; duration: number; price: number; features: string[]; }
export interface Gig {
  id: string; teacherId: string; title: string; description: string; subject: string; topic: string;
  level: string; language: string; tags: string[]; packages: GigPackage[]; demoUrl: string;
  includes: string[]; requirements: string; faqs: { q: string; a: string }[]; active: boolean; createdAt: string;
}
export interface Booking {
  id: string; studentId: string; teacherId: string; gigId: string; packageId: string; date: string; time: string;
  price: number; status: BookingStatus; history: { status: BookingStatus; at: string; note: string }[];
  createdAt: string; notes?: string; attendance?: { teacher: boolean; student: boolean }; recording?: { name: string; duration: number; url?: string };
}
export interface Payment { id: string; bookingId: string; studentId: string; amount: number; status: 'PAID' | 'REFUNDED'; transactionId: string; createdAt: string; }
export interface LedgerEntry { id: string; userId: string; type: 'PENDING_EARNING' | 'PLATFORM_FEE' | 'PAYOUT' | 'PAYMENT' | 'REFUND'; amount: number; ref: string; note: string; createdAt: string; }
export interface Message { id: string; conversationId: string; senderId: string; receiverId: string; body: string; createdAt: string; readAt?: string; }
export interface Notification { id: string; userId: string; type: string; title: string; body: string; href: string; readAt?: string; createdAt: string; }
export interface Review { id: string; bookingId: string; studentId: string; teacherId: string; rating: number; comment: string; createdAt: string; response?: string; }
export interface Question { id: string; teacherId: string; subject: string; topic: string; difficulty: string; text: string; options: string[]; answer: number; explanation: string; marks: number; tags: string[]; }
export interface Exam { id: string; teacherId: string; title: string; subject: string; topic: string; duration: number; passMark: number; questionIds: string[]; active: boolean; }
export interface ExamAttempt { id: string; examId: string; studentId: string; answers: Record<string, number>; score: number; total: number; passed: boolean; createdAt: string; }
export interface Favorite { id: string; userId: string; kind: 'TEACHER' | 'GIG' | 'COURSE'; itemId: string; createdAt: string; }
export interface Problem { id: string; studentId: string; title: string; description: string; subject: string; topic: string; budget: number; deadline: string; status: 'OPEN' | 'ACCEPTED' | 'DELIVERED' | 'CLOSED'; createdAt: string; }
export interface ProblemOffer { id: string; problemId: string; teacherId: string; message: string; price: number; status: 'PENDING' | 'ACCEPTED' | 'REJECTED'; createdAt: string; }
export interface ParentChild { id: string; parentId: string; childId: string; createdAt: string; }
export interface Report { id: string; reporterId: string; subjectType: string; subjectId: string; reason: string; status: 'OPEN' | 'RESOLVED'; createdAt: string; }
export interface AuditLog { id: string; actorId: string; action: string; entity: string; entityId: string; at: string; }
export interface AppState {
  users: User[]; subjects: Subject[]; teachers: Teacher[]; gigs: Gig[]; bookings: Booking[]; payments: Payment[];
  ledger: LedgerEntry[]; messages: Message[]; notifications: Notification[]; reviews: Review[]; questions: Question[];
  exams: Exam[]; attempts: ExamAttempt[]; favorites: Favorite[]; problems: Problem[]; offers: ProblemOffer[];
  parentChildren: ParentChild[]; reports: Report[]; audit: AuditLog[];
}
