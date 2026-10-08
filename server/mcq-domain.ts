export type McqOption = { label?: string; text: string };
export type ScoringConfig = { correctMark: number; wrongPenalty: number; unansweredMark: number };
export type ScoredAnswer = { correct: boolean; answered: boolean };

export const DEFAULT_SCORING: ScoringConfig = { correctMark: 1, wrongPenalty: 0, unansweredMark: 0 };

export function scoreAnswers(answers: ScoredAnswer[], config: ScoringConfig = DEFAULT_SCORING) {
  const correctCount = answers.filter(answer => answer.answered && answer.correct).length;
  const wrongCount = answers.filter(answer => answer.answered && !answer.correct).length;
  const unansweredCount = answers.length - correctCount - wrongCount;
  const score = correctCount * config.correctMark - wrongCount * config.wrongPenalty + unansweredCount * config.unansweredMark;
  const totalScore = answers.length * config.correctMark;
  const accuracy = correctCount + wrongCount ? correctCount / (correctCount + wrongCount) * 100 : 0;
  const percentage = totalScore ? Math.max(0, score / totalScore * 100) : 0;
  return { score, totalScore, correctCount, wrongCount, unansweredCount, accuracy, percentage };
}

export function fisherYates<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
}

export type CompletedAttemptForStats = {
  percentage: number;
  correctCount: number;
  wrongCount: number;
  questionCount: number;
  timeTakenSeconds: number;
  xpEarned: number;
  submittedAt: string | Date;
  subject?: string;
  chapter?: string | null;
};

function dhakaDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function dateOrdinal(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function deriveGamification(attempts: CompletedAttemptForStats[], now = new Date()) {
  const chronological = [...attempts].sort((left, right) => new Date(left.submittedAt).getTime() - new Date(right.submittedAt).getTime());
  const days = [...new Set(chronological.map(attempt => dhakaDate(attempt.submittedAt)))];
  let longestStreak = 0;
  let run = 0;
  let previousDay = -2;
  for (const day of days) {
    const ordinal = dateOrdinal(day);
    run = ordinal === previousDay + 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previousDay = ordinal;
  }
  const today = dateOrdinal(dhakaDate(now));
  const lastDay = days.length ? dateOrdinal(days[days.length - 1]!) : -2;
  let currentStreak = 0;
  if (lastDay >= today - 1) {
    currentStreak = 1;
    for (let index = days.length - 1; index > 0; index--) {
      if (dateOrdinal(days[index]!) - dateOrdinal(days[index - 1]!) !== 1) break;
      currentStreak++;
    }
  }
  const correctCount = attempts.reduce((sum, attempt) => sum + attempt.correctCount, 0);
  const answeredCount = attempts.reduce((sum, attempt) => sum + attempt.correctCount + attempt.wrongCount, 0);
  const totalQuestions = attempts.reduce((sum, attempt) => sum + attempt.questionCount, 0);
  const percentages = attempts.map(attempt => attempt.percentage);
  const xp = attempts.reduce((sum, attempt) => sum + attempt.xpEarned, 0);
  const badges: string[] = [];
  if (attempts.length >= 1) badges.push('প্রথম পরীক্ষা');
  if (attempts.length >= 10) badges.push('১০টি পরীক্ষা');
  if (totalQuestions >= 100) badges.push('১০০টি প্রশ্ন');
  if (totalQuestions >= 500) badges.push('৫০০টি প্রশ্ন');
  if (answeredCount > 0 && correctCount / answeredCount >= 0.9) badges.push('৯০% নির্ভুলতা');
  if (attempts.some(attempt => attempt.percentage === 100)) badges.push('নিখুঁত স্কোর');
  if (longestStreak >= 7) badges.push('৭ দিনের ধারাবাহিকতা');
  if (longestStreak >= 30) badges.push('৩০ দিনের ধারাবাহিকতা');
  return {
    totalExams: attempts.length,
    totalQuestions,
    totalAttempted: answeredCount,
    totalCorrect: correctCount,
    accuracy: answeredCount ? correctCount / answeredCount * 100 : 0,
    bestScore: percentages.length ? Math.max(...percentages) : 0,
    averageScore: percentages.length ? percentages.reduce((sum, percentage) => sum + percentage, 0) / percentages.length : 0,
    currentStreak,
    longestStreak,
    studyTimeSeconds: attempts.reduce((sum, attempt) => sum + attempt.timeTakenSeconds, 0),
    xp,
    level: Math.floor(Math.sqrt(xp / 100)) + 1,
    badges,
    recentAttempts: chronological.slice(-10).reverse()
  };
}
