import { useEffect, useState } from 'react';
import { api } from './api';
import { TeacherGigEditor, TeacherProfileEditor } from './teacher-dashboard-forms';
import { Avatar, Empty, bn, go, money, photoFromUser, shortDate } from './components';
import type { Booking, Gig, Teacher, User } from './models';
import './teacher-dashboard.css';

type DashboardData = {
  user: User;
  bookings: Booking[];
  teacher?: Teacher;
  gigs?: Gig[];
  wallet?: { pending: number };
  analytics?: { profileViews?: number; gigViews?: number };
};

const statusLabel = (status: string) => ({
  CONFIRMED: 'নিশ্চিত',
  IN_PROGRESS: 'চলমান',
  COMPLETED: 'সম্পন্ন',
  PENDING: 'অপেক্ষমাণ',
}[status] || status);

function DashboardStat({ icon, label, value, note, tone }: {
  icon: string;
  label: string;
  value: string | number;
  note: string;
  tone: string;
}) {
  return <article className="teacher-stat">
    <span className={`teacher-stat-icon ${tone}`} aria-hidden="true">{icon}</span>
    <div className="teacher-stat-copy">
      <small>{label}</small>
      <b>{value}</b>
      <span>{note}</span>
    </div>
  </article>;
}

export function TeacherDashboardLive({ data, onUserUpdated }: { data: DashboardData; onUserUpdated?: (user: User) => void }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [editingGig, setEditingGig] = useState<Gig | null>(null);
  const liveBookings = data.bookings.filter(booking => ['CONFIRMED', 'IN_PROGRESS'].includes(booking.status));
  const quickActions = [
    { icon: '＋', title: 'নতুন পরীক্ষা', note: 'শিক্ষার্থীদের জন্য পরীক্ষা তৈরি করুন', onClick: () => go('/teacher/exams/new') },
    { icon: '☷', title: 'পরীক্ষা পরিচালনা', note: 'পরীক্ষা ও ফলাফল গুছিয়ে রাখুন', onClick: () => go('/teacher/exams') },
    { icon: '▧', title: 'নতুন গিগ', note: 'নতুন শেখার প্যাকেজ প্রকাশ করুন', onClick: () => go('/teacher/gigs/new') },
    { icon: '✎', title: 'প্রোফাইল সম্পাদনা', note: 'তথ্য ও সময়সূচি হালনাগাদ করুন', onClick: () => setProfileOpen(true) },
  ];

  return <section className="page section teacher-dashboard">
    <header className="teacher-dashboard-heading learning-art-header">
      <div className="teacher-dashboard-heading-copy">
        <p className="eyebrow"><span className="teacher-dashboard-online" />শিক্ষক ড্যাশবোর্ড</p>
        <h1>স্বাগতম, {data.user.name}</h1>
        <p>আপনার ক্লাস, বুকিং ও শেখানোর প্যাকেজ এক জায়গায় গুছিয়ে নিন।</p>
      </div>
      <div className="teacher-dashboard-profile">
        <Avatar name={data.user.name} size="lg" teacherId={data.teacher?.id} photoUrl={photoFromUser(data.user)} />
        <div><small>আপনার প্রোফাইল</small><b>{data.teacher?.level || 'শিক্ষক'}</b></div>
        <button className="quiet-btn" onClick={() => setProfileOpen(true)}>সম্পাদনা</button>
      </div>
    </header>

    <div className="stats teacher-dashboard-stats">
      <DashboardStat icon="◉" tone="mint" label="প্রোফাইল দেখা হয়েছে" value={bn(data.analytics?.profileViews || 0)} note="মোট প্রোফাইল ভিউ" />
      <DashboardStat icon="▤" tone="blue" label="গিগ দেখা হয়েছে" value={bn(data.analytics?.gigViews || 0)} note="মোট গিগ ভিউ" />
      <DashboardStat icon="✓" tone="gold" label="নিশ্চিত বুকিং" value={bn(data.bookings.filter(booking => booking.status === 'CONFIRMED').length)} note="নিশ্চিত ক্লাস" />
      <DashboardStat icon="৳" tone="violet" label="অপেক্ষমাণ আয়" value={money(data.wallet?.pending || 0)} note="অ্যাকাউন্টের সারাংশ" />
    </div>

    <section className="teacher-live-panel" aria-labelledby="teacher-live-title">
      <div className="teacher-live-copy">
        <p className="eyebrow">আপনার ক্লাস</p>
        <h2 id="teacher-live-title">ক্লাসে যোগ দিন</h2>
        <p>নিশ্চিত ও চলমান বুকিং থেকে সরাসরি আপনার ক্লাসরুমে প্রবেশ করুন।</p>
        <span className="teacher-live-count"><b>{bn(liveBookings.length)}</b>টি ক্লাস যোগ দেওয়ার জন্য প্রস্তুত</span>
      </div>
      <div className="teacher-live-list">
        {liveBookings.length ? liveBookings.map(booking => <article className="teacher-live-item" key={booking.id}>
          <div className="teacher-live-time">
            <span className={`teacher-status ${booking.status}`}>{statusLabel(booking.status)}</span>
            <b>{shortDate(booking.date)}</b>
            <small>{booking.time}</small>
          </div>
          <button className="button light" onClick={() => go(`/classroom/${booking.id}`)}>ক্লাসে যোগ দিন <span aria-hidden="true">→</span></button>
        </article>) : <div className="teacher-live-empty">
          <span className="teacher-live-empty-icon" aria-hidden="true">◷</span>
          <div><b>এখন কোনো নিশ্চিত ক্লাস নেই</b><small>নতুন বুকিং নিশ্চিত হলে এখানে ক্লাসরুমের লিংক পাবেন।</small></div>
        </div>}
      </div>
    </section>

    <section className="teacher-quick-actions" aria-labelledby="teacher-actions-title">
      <div className="teacher-dashboard-section-head">
        <div><p className="eyebrow">দ্রুত শুরু করুন</p><h2 id="teacher-actions-title">দ্রুত কাজ</h2></div>
        <span>আপনার প্রয়োজনীয় টুলগুলো</span>
      </div>
      <div className="teacher-action-grid">
        {quickActions.map(action => <button className="teacher-action-card" key={action.title} onClick={action.onClick}>
          <span className="teacher-action-icon" aria-hidden="true">{action.icon}</span>
          <span className="teacher-action-copy"><b>{action.title}</b><small>{action.note}</small></span>
          <span className="teacher-action-arrow" aria-hidden="true">↗</span>
        </button>)}
      </div>
    </section>

    <div className="teacher-dashboard-columns">
      <section className="teacher-dashboard-panel" aria-labelledby="teacher-bookings-title">
        <div className="teacher-dashboard-section-head">
          <div><p className="eyebrow">বুকিং ম্যানেজমেন্ট</p><h2 id="teacher-bookings-title">সাম্প্রতিক বুকিং</h2></div>
          <button className="quiet-btn" onClick={() => go('/bookings')}>সব বুকিং <span aria-hidden="true">→</span></button>
        </div>
        {data.bookings.length ? <div className="teacher-booking-list">
          {data.bookings.slice(0, 5).map(booking => <article className="teacher-booking-item" key={booking.id}>
            <div className="teacher-booking-main">
              <div className="teacher-booking-date"><b>{shortDate(booking.date)}</b><span>{booking.time}</span></div>
              <div className="teacher-booking-details">
                <span className={`teacher-status ${booking.status}`}>{statusLabel(booking.status)}</span>
                <small>বুকিং #{booking.id.slice(-5)}</small>
              </div>
            </div>
            <div className="teacher-booking-side"><b>{money(booking.price)}</b><button className="quiet-btn" onClick={() => go(`/classroom/${booking.id}`)}>ক্লাসরুম</button></div>
          </article>)}
        </div> : <Empty>এখনও কোনো বুকিং নেই।</Empty>}
      </section>

      <section className="teacher-dashboard-panel" aria-labelledby="teacher-gigs-title">
        <div className="teacher-dashboard-section-head">
          <div><p className="eyebrow">আপনার শেখানোর প্যাকেজ</p><h2 id="teacher-gigs-title">আমার গিগ</h2></div>
          <button className="button small" onClick={() => go('/teacher/gigs/new')}>＋ নতুন গিগ</button>
        </div>
        {data.gigs?.length ? <div className="teacher-gig-list">
          {data.gigs.map(gig => <article className="teacher-gig-item" key={gig.id}>
            <span className="teacher-gig-icon" aria-hidden="true">▧</span>
            <div className="teacher-gig-copy"><b>{gig.title}</b><small>{gig.subject} · {money(gig.packages[0]?.price || 0)} থেকে</small></div>
            <div className="teacher-gig-actions"><button className="quiet-btn" onClick={() => go(`/gig/${gig.id}`)}>দেখুন</button><button className="button small" onClick={() => setEditingGig(gig)}>এডিট</button></div>
          </article>)}
        </div> : <Empty>এখনও কোনো গিগ নেই। নতুন গিগ তৈরি করে শিক্ষার্থীদের কাছে আপনার প্যাকেজ দেখান।</Empty>}
      </section>
    </div>

    {profileOpen && data.teacher && <TeacherProfileEditor teacher={data.teacher} user={data.user} onUserSaved={onUserUpdated} onClose={() => setProfileOpen(false)} onSaved={() => window.location.reload()} />}
    {editingGig && <TeacherGigEditor gig={editingGig} onClose={() => setEditingGig(null)} onSaved={() => window.location.reload()} />}
  </section>;
}

export function TeacherDashboardLivePage({ onUserUpdated }: { onUserUpdated?: (user: User) => void } = {}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    void api<DashboardData>('/dashboard').then(setData).catch(error => setError(error instanceof Error ? error.message : 'ড্যাশবোর্ড লোড করা যায়নি।'));
  }, []);
  if (error) return <section className="page section teacher-dashboard"><p className="teacher-dashboard-error">{error}</p></section>;
  if (!data) return <section className="page section teacher-dashboard" aria-live="polite"><div className="teacher-dashboard-loading"><span /><span /><span /><span /></div><p>ড্যাশবোর্ড লোড হচ্ছে...</p></section>;
  return <TeacherDashboardLive data={data} onUserUpdated={onUserUpdated} />;
}
