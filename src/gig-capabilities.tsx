import type { ChangeEvent } from 'react';
import type { GigDraft } from './models';

export function MediaManager({ draft, update }: { draft: GigDraft; update: (patch: Partial<GigDraft>) => void }) {
  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/', 'application/pdf'].some(type => file.type.startsWith(type)) || file.size > 2 * 1024 * 1024) {
      window.alert('শুধু ছবি বা PDF, সর্বোচ্চ ২ MB ফাইল যোগ করা যাবে।');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update({ media: [...draft.media, { id: crypto.randomUUID(), kind: file.type === 'application/pdf' ? 'DOCUMENT' : 'IMAGE', url: String(reader.result), caption: file.name, cover: draft.media.length === 0 }] });
    reader.readAsDataURL(file);
  };
  const move = (index: number, direction: -1 | 1) => {
    const next = [...draft.media]; const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]]; update({ media: next });
  };
  return <div className="media-manager"><label>ছবি বা PDF আপলোড<input type="file" accept="image/*,application/pdf" onChange={upload} /></label><small className="help">ফাইল লোকাল draft-এ থাকে; API key বা বাইরের upload service লাগে না। সর্বোচ্চ ২ MB।</small>{draft.media.map((media, index) => <div className="media-manager-row" key={media.id}><span>{media.kind === 'DOCUMENT' ? 'PDF' : 'ছবি'} {media.cover && '· কভার'}</span><input value={media.caption} onChange={e => update({ media: draft.media.map(item => item.id === media.id ? { ...item, caption: e.target.value } : item) })} placeholder="ক্যাপশন" /><button className="quiet-btn" onClick={() => move(index, -1)} disabled={index === 0}>↑</button><button className="quiet-btn" onClick={() => move(index, 1)} disabled={index === draft.media.length - 1}>↓</button><button className="quiet-btn" onClick={() => update({ media: draft.media.map(item => ({ ...item, cover: item.id === media.id })) })}>কভার</button></div>)}</div>;
}
