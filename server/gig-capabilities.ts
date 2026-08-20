import { id } from './seed.js';
import { cleanText, DomainError, requireRole } from './services.js';
import type { AppState, Gig, GigCustomOffer, GigModeration, User } from './types.js';

const now = () => new Date().toISOString();
const teacherGig = (state: AppState, actor: User, gigId: string) => {
  requireRole(actor, ['TEACHER']);
  const teacher = state.teachers.find(t => t.userId === actor.id);
  const gig = state.gigs.find(g => g.id === gigId && g.teacherId === teacher?.id);
  if (!gig) throw new DomainError('গিগটি পাওয়া যায়নি।', 404);
  return gig;
};
export function recordGigView(state: AppState, gigId: string) {
  const analytics = state.gigAnalytics ?? (state.gigAnalytics = []);
  const row = analytics.find(a => a.gigId === gigId) ?? { gigId, views: 0, favorites: 0, bookings: 0, revenue: 0, conversion: 0, averageRating: 0 };
  row.views += 1;
  if (!analytics.includes(row)) analytics.push(row);
}
export function duplicateGig(state: AppState, actor: User, gigId: string) {
  const source = teacherGig(state, actor, gigId);
  const copy: Gig = { ...structuredClone(source), id: id('gig'), title: `${source.title} (কপি)`, active: false, moderationStatus: 'PENDING', version: 1, createdAt: now(), packages: source.packages.map(p => ({ ...p, id: id('package') })) };
  state.gigs.push(copy);
  (state.gigModeration ??= []).push({ gigId: copy.id, status: 'PENDING', note: 'কপি গিগ প্রকাশের আগে মডারেশন প্রয়োজন', updatedAt: now() });
  return copy;
}
export function editGig(state: AppState, actor: User, gigId: string, input: Record<string, unknown>) {
  const gig = teacherGig(state, actor, gigId);
  const allowed = ['title', 'description', 'subject', 'topic', 'level', 'tags', 'demoUrl', 'includes', 'requirements', 'faqs', 'packages', 'extras', 'media', 'availability', 'cancellation', 'reschedule', 'visibility'];
  for (const key of allowed) if (input[key] !== undefined) (gig as unknown as Record<string, unknown>)[key] = input[key];
  gig.active = false;
  gig.moderationStatus = 'PENDING';
  gig.version = (gig.version || 1) + 1;
  (state.gigVersions ??= []).push({ id: id('gig-version'), gigId, version: gig.version, snapshot: structuredClone(gig) as unknown as Record<string, unknown>, createdAt: now() });
  return gig;
}
export function createCustomOffer(state: AppState, actor: User, input: Record<string, unknown>) {
  requireRole(actor, ['TEACHER']);
  const gig = teacherGig(state, actor, String(input.gigId));
  const price = Number(input.price);
  if (!Number.isFinite(price) || price < 0) throw new DomainError('সঠিক কাস্টম মূল্য দিন।');
  const offer: GigCustomOffer = { id: id('gig-offer'), gigId: gig.id, teacherId: actor.id, studentId: typeof input.studentId === 'string' ? input.studentId : undefined, title: cleanText(input.title, 'অফারের শিরোনাম', 160), description: cleanText(input.description, 'অফারের বিবরণ', 2000), price, status: 'SENT', createdAt: now() };
  (state.gigOffers ??= []).push(offer);
  return offer;
}
export function acceptCustomOffer(state: AppState, actor: User, offerId: string) {
  requireRole(actor, ['STUDENT']);
  const offer = (state.gigOffers ?? []).find(o => o.id === offerId && (!o.studentId || o.studentId === actor.id));
  if (!offer) throw new DomainError('কাস্টম অফার পাওয়া যায়নি।', 404);
  offer.studentId = actor.id; offer.status = 'ACCEPTED'; return offer;
}
export function moderateGig(state: AppState, actor: User, gigId: string, status: GigModeration['status'], note: string) {
  requireRole(actor, ['ADMIN', 'SUPER_ADMIN']);
  const gig = state.gigs.find(g => g.id === gigId); if (!gig) throw new DomainError('গিগটি পাওয়া যায়নি।', 404);
  gig.moderationStatus = status; gig.active = status === 'APPROVED';
  const moderation = state.gigModeration ?? (state.gigModeration = []);
  const row = moderation.find(m => m.gigId === gigId) ?? { gigId, status, note, updatedAt: now() };
  row.status = status; row.note = note; row.updatedAt = now(); if (!moderation.includes(row)) moderation.push(row);
  return gig;
}
