import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createDemoProblems, createDemoState, ensureAdditionalPracticeExams } from './seed.js';
import type { AppState } from './types.js';

function ensureLiveDemoClassroom(state: AppState) {
  if (state.bookings.some(booking => booking.id === 'booking-demo-live')) return false;
  const template = state.bookings.find(booking => booking.id === 'booking-1');
  if (!template) return false;
  const now = new Date().toISOString();
  state.bookings.push({
    ...template,
    id: 'booking-demo-live',
    date: now.slice(0, 10),
    time: 'এখন',
    status: 'IN_PROGRESS',
    history: [
      { status: 'CONFIRMED', at: now, note: 'ডেমো লাইভ ক্লাস প্রস্তুত' },
      { status: 'IN_PROGRESS', at: now, note: 'ডেমো ক্লাসরুমে এখনই যোগ দেওয়া যাবে' }
    ],
    createdAt: now,
    notes: 'এটি শিক্ষার্থী ও শিক্ষকের জন্য স্থায়ী ডেমো লাইভ ক্লাস।',
    attendance: { teacher: false, student: false }
  });
  return true;
}

/** লোকাল ডেমো স্টোর। একক Node প্রক্রিয়ায় প্রতিটি পরিবর্তন atomically ডিস্কে লেখা হয়। */
export class LocalStore {
  private state: AppState;
  constructor(private readonly file = resolve(process.cwd(), 'data', 'shikhok-demo.json'), reset = false) {
    if (reset || !existsSync(file)) { this.state = createDemoState(); ensureLiveDemoClassroom(this.state); this.persist(); }
    else {
      this.state = JSON.parse(readFileSync(file, 'utf8')) as AppState;
      const problems = this.state.problems ?? (this.state.problems = []);
      const additions = createDemoProblems().filter(problem => !problems.some(existing => existing.id === problem.id));
      let changed = false;
      if (additions.length) { problems.push(...additions); changed = true; }
      if (ensureAdditionalPracticeExams(this.state)) changed = true;
      if (ensureLiveDemoClassroom(this.state)) changed = true;
      if (changed) this.persist();
    }
  }
  read(): AppState { return structuredClone(this.state); }
  transaction<T>(operation: (draft: AppState) => T): T {
    const draft = structuredClone(this.state); const result = operation(draft); this.state = draft; this.persist(); return result;
  }
  private persist() { mkdirSync(dirname(this.file), { recursive: true }); const temp = `${this.file}.tmp`; writeFileSync(temp, JSON.stringify(this.state, null, 2), 'utf8'); renameSync(temp, this.file); }
}

export const store = new LocalStore();
