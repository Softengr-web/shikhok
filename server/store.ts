import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createDemoState } from './seed.js';
import type { AppState } from './types.js';

/** লোকাল ডেমো স্টোর। একক Node প্রক্রিয়ায় প্রতিটি পরিবর্তন atomically ডিস্কে লেখা হয়। */
export class LocalStore {
  private state: AppState;
  constructor(private readonly file = resolve(process.cwd(), 'data', 'shikhok-demo.json'), reset = false) {
    if (reset || !existsSync(file)) { this.state = createDemoState(); this.persist(); }
    else this.state = JSON.parse(readFileSync(file, 'utf8')) as AppState;
  }
  read(): AppState { return structuredClone(this.state); }
  transaction<T>(operation: (draft: AppState) => T): T {
    const draft = structuredClone(this.state); const result = operation(draft); this.state = draft; this.persist(); return result;
  }
  private persist() { mkdirSync(dirname(this.file), { recursive: true }); const temp = `${this.file}.tmp`; writeFileSync(temp, JSON.stringify(this.state, null, 2), 'utf8'); renameSync(temp, this.file); }
}

export const store = new LocalStore();
