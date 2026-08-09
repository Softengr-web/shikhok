import { LocalStore } from './store.js';
const reset = process.argv.includes('--reset');
new LocalStore(undefined, reset);
console.log(reset ? 'লোকাল ডেমো ডেটা নতুন করে তৈরি হয়েছে।' : 'লোকাল ডেমো ডেটা প্রস্তুত আছে।');
