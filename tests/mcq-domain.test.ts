import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveGamification, fisherYates, scoreAnswers } from '../server/mcq-domain.js';
import { questionContentHash, questionHash } from '../server/mcq-service.js';

test('MCQ scoring reconciles correct, wrong and unanswered answers', () => {
  const result = scoreAnswers([
    { answered: true, correct: true },
    { answered: true, correct: false },
    { answered: false, correct: false }
  ]);
  assert.equal(result.score, 1);
  assert.equal(result.totalScore, 3);
  assert.equal(result.correctCount, 1);
  assert.equal(result.wrongCount, 1);
  assert.equal(result.unansweredCount, 1);
  assert.equal(result.accuracy, 50);
  assert.ok(Math.abs(result.percentage - 100 / 3) < 1e-10);
});

test('MCQ scoring stores negative marking in the scoring configuration', () => {
  const result = scoreAnswers([
    { answered: true, correct: true },
    { answered: true, correct: false },
    { answered: false, correct: false }
  ], { correctMark: 1, wrongPenalty: 0.25, unansweredMark: 0 });
  assert.equal(result.score, 0.75);
  assert.equal(result.totalScore, 3);
  assert.equal(result.accuracy, 50);
});

test('question randomization is deterministic when a test random source is supplied', () => {
  const values = [0, 0, 0];
  let index = 0;
  assert.deepEqual(fisherYates([1, 2, 3, 4], () => values[index++] ?? 0), [2, 3, 4, 1]);
});

test('question duplicate identity preserves the source class and chapter scope', () => {
  const options = [{ label: 'ক', text: 'প্রথম' }, { label: 'খ', text: 'দ্বিতীয়' }];
  const scope = { classLevel: 'Class 3', subject: 'গণিত', part: 'MCQ', chapter: 'Chapter 1' };
  assert.equal(questionHash('প্রশ্ন?', options, scope), questionHash(' প্রশ্ন? ', options, scope));
  assert.notEqual(questionHash('প্রশ্ন?', options, scope), questionHash('প্রশ্ন?', options, { ...scope, chapter: 'Chapter 2' }));
  assert.notEqual(questionHash('প্রশ্ন?', options, scope), questionHash('প্রশ্ন?', options, { ...scope, classLevel: 'Class 4' }));
  assert.notEqual(questionHash('প্রশ্ন?', options, scope, ['image-a']), questionHash('প্রশ্ন?', options, scope, ['image-b']));
  assert.equal(questionContentHash('প্রশ্ন?', options, scope), questionContentHash('প্রশ্ন?', options, scope));
});

test('gamification derives XP, badges and Bangladesh-local-day streaks', () => {
  const stats = deriveGamification([
    { percentage: 100, correctCount: 5, wrongCount: 0, questionCount: 5, timeTakenSeconds: 90, xpEarned: 50, submittedAt: '2026-10-06T19:00:00.000Z' },
    { percentage: 80, correctCount: 4, wrongCount: 1, questionCount: 5, timeTakenSeconds: 100, xpEarned: 30, submittedAt: '2026-10-07T19:00:00.000Z' }
  ], new Date('2026-10-08T04:00:00.000Z'));
  assert.equal(stats.totalExams, 2);
  assert.equal(stats.totalQuestions, 10);
  assert.equal(stats.totalAttempted, 10);
  assert.equal(stats.totalCorrect, 9);
  assert.equal(stats.longestStreak, 2);
  assert.equal(stats.currentStreak, 2);
  assert.equal(stats.xp, 80);
  assert.ok(stats.badges.includes('নিখুঁত স্কোর'));
});
