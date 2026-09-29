import { useState } from 'react';
import { put } from './api';
import { ProfilePhotoPicker } from './profile-editors';
import { photoFromUser } from './components';
import type { Gig, Teacher, User } from './models';

type ProfileProps = { teacher: Teacher; user: User; onClose: () => void; onSaved?: () => void; onUserSaved?: (user: User) => void };
const parseAvailability = (raw: string) => Object.fromEntries(raw.split(/\n|;/).map(line => line.trim()).filter(Boolean).flatMap(line => { const index = line.indexOf(':'); if (index < 0) return []; const day = line.slice(0, index).trim(); const slots = line.slice(index + 1).split(',').map(value => value.trim()).filter(Boolean); return day ? [[day, slots]] : []; }));
const parseList = (raw: string) => raw.split(',').map(value => value.trim()).filter(Boolean);

export function TeacherProfileEditor({ teacher, user, onClose, onSaved, onUserSaved }: ProfileProps) {
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone || '',
    photoUrl: photoFromUser(user) || '',
    headline: teacher.headline,
    bio: teacher.bio,
    education: teacher.education,
    institution: teacher.institution,
    location: teacher.location,
    hourlyRate: String(teacher.hourlyRate),
    sessionPrice: String(teacher.sessionPrice ?? teacher.hourlyRate),
    experienceYears: String(teacher.experienceYears),
    subjects: (teacher.subjects || []).join(', '),
    skills: (teacher.skills || []).join(', '),
    languages: (teacher.languages || []).join(', '),
    demoUrl: teacher.demoUrl,
    availability: Object.entries(teacher.availability || {}).map(([day, slots]) => `${day}: ${slots.join(', ')}`).join('\n'),
  });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setBusy(true);
    try {
      const result = await put<{ user: User }>('/profile', {
        name: form.name,
        phone: form.phone,
        photoUrl: form.photoUrl,
        teacher: {
          headline: form.headline,
          bio: form.bio,
          education: form.education,
          institution: form.institution,
          location: form.location,
          hourlyRate: Number(form.hourlyRate),
          sessionPrice: Number(form.sessionPrice),
          experienceYears: Number(form.experienceYears),
          subjects: parseList(form.subjects),
          skills: parseList(form.skills),
          languages: parseList(form.languages),
          demoUrl: form.demoUrl,
          availability: parseAvailability(form.availability),
        },
      });
      onUserSaved?.(result.user);
      setMessage('আপনার নাম, ছবি ও শিক্ষক প্রোফাইল সংরক্ষিত হয়েছে।');
      window.setTimeout(() => { onClose(); onSaved?.(); }, 450);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'প্রোফাইল সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।'); }
    finally { setBusy(false); }
  };

  return <div className="modal-back profile-editor-backdrop"><section className="modal dashboard-editor profile-editor-modal" role="dialog" aria-modal="true" aria-labelledby="teacher-profile-title">
    <button className="close" type="button" onClick={onClose} aria-label="বন্ধ করুন">×</button>
    <p className="eyebrow">শিক্ষক অ্যাকাউন্ট</p><h2 id="teacher-profile-title">প্রোফাইল ও সময়সূচি সম্পাদনা</h2><p className="profile-editor-lead">আপনার পরিচয়, অভিজ্ঞতা ও শেখানোর তথ্য এক জায়গা থেকে হালনাগাদ করুন।</p>
    <form onSubmit={save}>
      <ProfilePhotoPicker name={form.name || user.name} photoUrl={form.photoUrl} onChange={value => update('photoUrl', value)}/>
      <div className="profile-editor-section"><h3>ব্যক্তিগত তথ্য</h3><div className="two">
        <label>নাম<input value={form.name} onChange={event => update('name', event.target.value)} maxLength={100} autoComplete="name" required/></label>
        <label>ফোন নম্বর<input type="tel" value={form.phone} onChange={event => update('phone', event.target.value)} maxLength={24} autoComplete="tel" placeholder="01XXXXXXXXX"/></label>
      </div><label>ইমেইল<input value={user.email} readOnly disabled/><small>অ্যাকাউন্টের ইমেইল নিরাপত্তার জন্য এখানে পরিবর্তন করা যাবে না।</small></label></div>
      <div className="profile-editor-section"><h3>শিক্ষক পরিচিতি</h3>
        <label>প্রোফাইল শিরোনাম<input value={form.headline} onChange={event => update('headline', event.target.value)} maxLength={160} placeholder="যেমন: ৮ বছরের অভিজ্ঞ গণিত শিক্ষক" required/></label>
        <label>পরিচিতি<textarea rows={3} value={form.bio} onChange={event => update('bio', event.target.value)} maxLength={2000} placeholder="আপনার পড়ানোর অভিজ্ঞতা ও পদ্ধতি সম্পর্কে লিখুন" required/></label>
        <div className="two"><label>শিক্ষাগত যোগ্যতা<input value={form.education} onChange={event => update('education', event.target.value)} maxLength={160}/></label><label>প্রতিষ্ঠান<input value={form.institution} onChange={event => update('institution', event.target.value)} maxLength={160}/></label></div>
        <div className="two"><label>অবস্থান<input value={form.location} onChange={event => update('location', event.target.value)} maxLength={120} placeholder="যেমন: ধানমন্ডি, ঢাকা"/></label><label>পড়ানোর অভিজ্ঞতা (বছর)<input type="number" min="0" max="80" value={form.experienceYears} onChange={event => update('experienceYears', event.target.value)}/></label></div>
        <label>যে বিষয় পড়ান<input value={form.subjects} onChange={event => update('subjects', event.target.value)} maxLength={500} placeholder="যেমন: গণিত, পদার্থবিজ্ঞান"/><small>বিষয়গুলো কমা দিয়ে আলাদা করুন।</small></label>
        <label>দক্ষতা ও টপিক<input value={form.skills} onChange={event => update('skills', event.target.value)} maxLength={700} placeholder="যেমন: বীজগণিত, ভর্তি প্রস্তুতি"/><small>দক্ষতাগুলো কমা দিয়ে আলাদা করুন।</small></label>
        <label>পাঠদানের ভাষা<input value={form.languages} onChange={event => update('languages', event.target.value)} maxLength={300} placeholder="যেমন: বাংলা, ইংরেজি"/></label>
      </div>
      <div className="profile-editor-section"><h3>ক্লাস ও সময়সূচি</h3><div className="two">
        <label>প্রতি ঘণ্টার মূল্য (৳)<input type="number" min="0" value={form.hourlyRate} onChange={event => update('hourlyRate', event.target.value)} required/></label>
        <label>সেশন ফি (৳)<input type="number" min="0" value={form.sessionPrice} onChange={event => update('sessionPrice', event.target.value)} required/></label>
      </div><label>পাঠের ভিডিও URL<input type="url" value={form.demoUrl} onChange={event => update('demoUrl', event.target.value)} maxLength={500} placeholder="https://…"/></label>
      <label>সাপ্তাহিক সময়সূচি<textarea rows={4} value={form.availability} onChange={event => update('availability', event.target.value)} placeholder="সোমবার: ১০:০০, ১৬:০০\nবুধবার: ১৪:০০, ১৮:০০"/><small>প্রতি লাইনে একটি দিন লিখুন; সময়গুলো কমা দিয়ে আলাদা করুন।</small></label></div>
      {message && <p className={message.includes('সংরক্ষিত') ? 'success' : 'form-error'} role="status">{message}</p>}
      <div className="profile-editor-footer"><button className="quiet-btn" type="button" onClick={onClose}>বাতিল</button><button className="button" disabled={busy}>{busy ? 'সংরক্ষণ হচ্ছে…' : 'পরিবর্তন সংরক্ষণ করুন'}</button></div>
    </form>
  </section></div>;
}

export function TeacherGigEditor({ gig, onClose, onSaved }: { gig: Gig; onClose: () => void; onSaved?: () => void }) {
  const [form, setForm] = useState({ title: gig.title, description: gig.description, subject: gig.subject, topic: gig.topic, level: gig.level, price: String(gig.packages[0]?.price || 0) });
  const [message, setMessage] = useState('');
  const update = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));
  const save = async (event: React.FormEvent) => { event.preventDefault(); setMessage(''); try { await put(`/teacher/gigs/${gig.id}`, { ...form, packages: gig.packages.map((pack, index) => index === 0 ? { ...pack, price: Number(form.price) } : pack) }); setMessage('গিগ সফলভাবে সংরক্ষিত হয়েছে।'); onSaved?.(); } catch (error) { setMessage(error instanceof Error ? error.message : 'গিগ সংরক্ষণ করা যায়নি।'); } };
  return <div className="modal-back"><section className="modal dashboard-editor"><button className="close" onClick={onClose}>×</button><p className="eyebrow">গিগ সম্পাদনা</p><h2>{gig.title}</h2><form onSubmit={save}><label>শিরোনাম<input value={form.title} onChange={event => update('title', event.target.value)} required /></label><label>বর্ণনা<textarea value={form.description} onChange={event => update('description', event.target.value)} required /></label><div className="two"><label>বিষয়<input value={form.subject} onChange={event => update('subject', event.target.value)} required /></label><label>টপিক<input value={form.topic} onChange={event => update('topic', event.target.value)} required /></label></div><div className="two"><label>শিক্ষার স্তর<input value={form.level} onChange={event => update('level', event.target.value)} required /></label><label>বেসিক মূল্য<input type="number" min="1" value={form.price} onChange={event => update('price', event.target.value)} required /></label></div>{message && <p className={message.includes('সফল') ? 'success' : 'form-error'}>{message}</p>}<button className="button wide">গিগ সংরক্ষণ করুন</button></form></section></div>;
}
