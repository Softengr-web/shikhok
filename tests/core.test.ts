import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoState } from '../server/seed.js';
import { DomainError, authenticate, createBooking, createProblemSession, createReview, payBooking, register, requireRole, submitExam } from '../server/services.js';

test('ডেমো অ্যাকাউন্ট দিয়ে লগইন করা যায়', () => {
  const state = createDemoState();
  const user = authenticate(state, 'student@demo.local', 'demo123');
  assert.equal(user.role, 'STUDENT');
  const activeDemo = authenticate(state, 'demo@demo.local', 'demo123');
  assert.equal(activeDemo.name, 'ডেমো শিক্ষার্থী');
  assert.throws(() => authenticate(state, 'student@demo.local', 'ভুলপাস'), DomainError);
});
test('রোল ছাড়া শিক্ষক কাজ করা যায় না', () => {
  const state = createDemoState();
  const student = state.users.find(u => u.id === 'student-1')!;
  assert.throws(() => requireRole(student, ['TEACHER']), DomainError);
  const newcomer = register(state, { name: 'নতুন শিক্ষার্থী', email: 'new@demo.local', password: 'secret7', role: 'STUDENT' });
  assert.equal(newcomer.email, 'new@demo.local');
});
test('ডাবল বুকিং প্রতিরোধ ও ডেমো পেমেন্ট লেজার তৈরি করে', () => {
  const state = createDemoState();
  const student = state.users.find(u => u.id === 'student-2')!;
  const gig = state.gigs[1];
  const booking = createBooking(state, student, { gigId: gig.id, packageId: gig.packages[0].id, date: '2030-10-10', time: '১০:০০' });
  assert.equal(booking.status, 'PENDING');
  assert.throws(() => createBooking(state, student, { gigId: gig.id, packageId: gig.packages[0].id, date: '2030-10-10', time: '১০:০০' }), DomainError);
  const receipt = payBooking(state, student, booking.id);
  assert.equal(receipt.booking.status, 'CONFIRMED');
  assert.match(receipt.payment.transactionId, /^DEMO-/);
  assert.ok(state.ledger.some(x => x.ref === booking.id && x.type === 'PENDING_EARNING'));
});
test('পরীক্ষার নম্বর সার্ভার-সাইডে হিসাব হয়', () => {
  const state = createDemoState();
  const student = state.users.find(u => u.id === 'student-1')!;
  const exam = state.exams[0];
  const answers = Object.fromEntries(exam.questionIds.map(id => [id, state.questions.find(q => q.id === id)!.answer]));
  const result = submitExam(state, student, exam.id, answers);
  assert.equal(result.score, result.total);
  assert.equal(result.passed, true);
});
test('একটি বুকিংয়ে কেবল একটি রিভিউ দেওয়া যায়', () => {
  const state = createDemoState();
  const student = state.users.find(u => u.id === 'student-1')!;
  const booking = state.bookings[0];
  const review = createReview(state, student, { bookingId: booking.id, rating: 5, comment: 'খুব ভালো' });
  assert.equal(review.rating, 5);
  assert.throws(() => createReview(state, student, { bookingId: booking.id, rating: 5, comment: 'আবার' }), DomainError);
});

test('সমস্যা সমাধানের এক-এক সেশন বুকিংও ডেমো পেমেন্ট দিয়ে নিশ্চিত হয়', () => {
  const state = createDemoState();
  const student = state.users.find(u => u.id === 'student-1')!;
  const teacher = state.teachers[0];
  const booking = createProblemSession(state, student, {
    teacherId: teacher.id,
    date: '2030-11-12',
    time: '১৬:০০',
    price: teacher.sessionPrice ?? teacher.hourlyRate,
    subject: 'গণিত'
  });
  assert.equal(booking.teacherId, teacher.id);
  assert.equal(booking.status, 'PENDING');
  const receipt = payBooking(state, student, booking.id);
  assert.equal(receipt.booking.status, 'CONFIRMED');
  assert.match(receipt.payment.transactionId, /^DEMO-/);
});
