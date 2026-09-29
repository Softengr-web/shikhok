import { useRef, useState } from 'react';
import { put } from './api';
import { Avatar, photoFromUser } from './components';
import type { User } from './models';
import './profile-editors.css';

type ProfilePhotoPickerProps = { name: string; photoUrl: string; onChange: (value: string) => void };

async function compressProfilePhoto(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('JPG, PNG বা WebP ছবি বেছে নিন।');
  if (file.size > 8 * 1024 * 1024) throw new Error('ছবির আকার ৮ MB-এর মধ্যে রাখুন।');
  const bitmap = await createImageBitmap(file);
  const size = 200;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) { bitmap.close(); throw new Error('ছবিটি প্রস্তুত করা যায়নি। অন্য ছবি বেছে নিন।'); }
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const cropWidth = size / scale;
  const cropHeight = size / scale;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);
  context.drawImage(bitmap, (bitmap.width - cropWidth) / 2, (bitmap.height - cropHeight) / 2, cropWidth, cropHeight, 0, 0, size, size);
  bitmap.close();

  let blob: Blob | null = null;
  for (const quality of [0.82, 0.72, 0.62, 0.52]) {
    blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size <= 120_000) break;
  }
  if (!blob || blob.size > 120_000) throw new Error('ছবিটি ছোট করা যায়নি। অন্য ছবি বেছে নিন।');
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('ছবি পড়া যায়নি।'));
    reader.onerror = () => reject(new Error('ছবি পড়া যায়নি।'));
    reader.readAsDataURL(blob);
  });
}

export function ProfilePhotoPicker({ name, photoUrl, onChange }: ProfilePhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const choose = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try { onChange(await compressProfilePhoto(file)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'ছবি আপলোড করা যায়নি।'); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  };
  return <div className="profile-photo-wrap">
    <div className="profile-photo-picker">
      <Avatar name={name} size="lg" photoUrl={photoUrl || undefined}/>
      <div className="profile-photo-copy"><b>প্রোফাইল ছবি</b><small>JPG, PNG বা WebP · সর্বোচ্চ ৮ MB</small><div className="profile-photo-actions">
        <input ref={inputRef} id="profile-photo-file" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => void choose(event.currentTarget.files?.[0])}/>
        <label className="quiet-btn" htmlFor="profile-photo-file">{busy ? 'ছবি প্রস্তুত হচ্ছে…' : photoUrl ? 'ছবি বদলান' : 'ছবি বেছে নিন'}</label>
        {photoUrl && <button type="button" className="photo-remove" onClick={() => { onChange(''); setError(''); }}>ছবি সরান</button>}
      </div></div>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}

export function StudentProfileEditor({ user, onClose, onSaved, onUserSaved }: { user: User; onClose: () => void; onSaved?: () => void; onUserSaved?: (user: User) => void }) {
  const profile = user.profile || {};
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone || '',
    photoUrl: photoFromUser(user) || '',
    schoolName: typeof profile.schoolName === 'string' ? profile.schoolName : '',
    gradeLevel: typeof profile.gradeLevel === 'string' ? profile.gradeLevel : '',
    subjects: Array.isArray(profile.subjects) ? profile.subjects.filter((value): value is string => typeof value === 'string').join(', ') : '',
    learningGoals: typeof profile.learningGoals === 'string' ? profile.learningGoals : '',
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const update = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const result = await put<{ user: User }>('/profile', { ...form, subjects: form.subjects.split(',').map(value => value.trim()).filter(Boolean) });
      onUserSaved?.(result.user);
      setMessage('আপনার প্রোফাইল সংরক্ষিত হয়েছে।');
      window.setTimeout(() => { onClose(); onSaved?.(); }, 450);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'প্রোফাইল সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।'); }
    finally { setBusy(false); }
  };
  return <div className="modal-back profile-editor-backdrop"><section className="modal dashboard-editor profile-editor-modal" role="dialog" aria-modal="true" aria-labelledby="student-profile-title">
    <button className="close" type="button" onClick={onClose} aria-label="বন্ধ করুন">×</button>
    <p className="eyebrow">শিক্ষার্থী অ্যাকাউন্ট</p><h2 id="student-profile-title">আপনার প্রোফাইল সম্পাদনা</h2><p className="profile-editor-lead">পরিচয় ও শেখার তথ্য হালনাগাদ রাখুন, যাতে শিক্ষক আপনার প্রয়োজন বুঝতে পারেন।</p>
    <form onSubmit={save}>
      <ProfilePhotoPicker name={form.name || user.name} photoUrl={form.photoUrl} onChange={value => update('photoUrl', value)}/>
      <div className="profile-editor-section"><h3>ব্যক্তিগত তথ্য</h3><div className="two">
        <label>নাম<input value={form.name} onChange={event => update('name', event.target.value)} maxLength={100} autoComplete="name" required/></label>
        <label>ফোন নম্বর<input type="tel" value={form.phone} onChange={event => update('phone', event.target.value)} maxLength={24} autoComplete="tel" placeholder="01XXXXXXXXX"/></label>
      </div><label>ইমেইল<input value={user.email} readOnly disabled/><small>অ্যাকাউন্টের ইমেইল নিরাপত্তার জন্য এখানে পরিবর্তন করা যাবে না।</small></label></div>
      <div className="profile-editor-section"><h3>শেখার পরিচিতি</h3><div className="two">
        <label>শিক্ষাপ্রতিষ্ঠান<input value={form.schoolName} onChange={event => update('schoolName', event.target.value)} maxLength={120} placeholder="যেমন: ঢাকা কলেজ"/></label>
        <label>শ্রেণি বা স্তর<input value={form.gradeLevel} onChange={event => update('gradeLevel', event.target.value)} maxLength={60} placeholder="যেমন: নবম শ্রেণি"/></label>
      </div><label>যে বিষয়গুলো শিখতে চান<input value={form.subjects} onChange={event => update('subjects', event.target.value)} maxLength={500} placeholder="যেমন: গণিত, ইংরেজি, পদার্থবিজ্ঞান"/><small>বিষয়গুলো কমা দিয়ে আলাদা করুন।</small></label><label>আপনার শেখার লক্ষ্য<textarea rows={3} value={form.learningGoals} onChange={event => update('learningGoals', event.target.value)} maxLength={500} placeholder="কোন দক্ষতা বা পরীক্ষার প্রস্তুতিতে সহায়তা চান?"/></label></div>
      {message && <p className={message.includes('সংরক্ষিত') ? 'success' : 'form-error'} role="status">{message}</p>}
      <div className="profile-editor-footer"><button className="quiet-btn" type="button" onClick={onClose}>বাতিল</button><button className="button" disabled={busy}>{busy ? 'সংরক্ষণ হচ্ছে…' : 'পরিবর্তন সংরক্ষণ করুন'}</button></div>
    </form>
  </section></div>;
}
