import { useEffect, useRef, useState } from 'react';
import { api, post } from './api';
import { Avatar, Empty, Loading, bn, go, photoFromUser, shortDate } from './components';
import type { Booking, User } from './models';

type BoardState = { pages: string[]; page: number };
type ChatItem = { id: string; senderId: string; name: string; text: string; createdAt: string };
type RoomUser = { id: string; name: string; role: User['role'] };
type MediaState = { camera: boolean; mic: boolean; screen: boolean };
type RoomPacket = {
  type: string; bookingId?: string; user?: RoomUser; userId?: string; fromId?: string;
  peers?: Array<{ user: RoomUser } & MediaState>; media?: MediaState; camera?: boolean; mic?: boolean; screen?: boolean;
  board?: BoardState; chat?: ChatItem[]; message?: ChatItem | string; data?: RTCSessionDescriptionInit | RTCIceCandidateInit;
  body?: string; error?: string;
};

const emptyBoard: BoardState = { pages: [''], page: 0 };

export function ClassroomRoom({ user }: { user: User }) {
  const bookingId = location.hash.split('/')[2]?.split('?')[0] || '';
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loadError, setLoadError] = useState('');
  const [camera, setCamera] = useState(false);
  const [mic, setMic] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [peerOnline, setPeerOnline] = useState(false);
  const [callState, setCallState] = useState<'waiting' | 'connecting' | 'connected' | 'disconnected'>('waiting');
  const [remoteCamera, setRemoteCamera] = useState(false);
  const [remoteMic, setRemoteMic] = useState(false);
  const [remoteScreen, setRemoteScreen] = useState(false);
  const [needsAudioTap, setNeedsAudioTap] = useState(false);
  const [otherUser, setOtherUser] = useState<RoomUser | null>(null);
  const [board, setBoard] = useState<BoardState>(emptyBoard);
  const [tab, setTab] = useState<'board' | 'chat' | 'notes'>('board');
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [message, setMessage] = useState('');
  const [notes, setNotes] = useState('');
  const [recording, setRecording] = useState<'idle' | 'recording' | 'paused' | 'done'>('idle');
  const [recordUrl, setRecordUrl] = useState('');
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [feedback, setFeedback] = useState('');
  const stream = useRef<MediaStream | null>(null);
  const displayStream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const video = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const remoteStream = useRef<MediaStream | null>(null);
  const roomSocket = useRef<WebSocket | null>(null);
  const peer = useRef<RTCPeerConnection | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const offerPending = useRef(false);
  const iceRestartAttempts = useRef(0);
  const otherUserRef = useRef<RoomUser | null>(otherUser);
  const mediaStateRef = useRef<MediaState>({ camera, mic, screen: sharing });
  otherUserRef.current = otherUser;
  mediaStateRef.current = { camera, mic, screen: sharing };
  const participantRole = user.role === 'TEACHER' ? 'শিক্ষার্থী' : 'শিক্ষক';

  useEffect(() => {
    let active = true;
    void api<Booking[]>('/bookings').then(items => {
      const found = items.find(item => item.id === bookingId) || null;
      if (!active) return;
      if (bookingId === 'booking-1' && found?.status === 'COMPLETED' && ['student-1', 'teacher-1'].includes(user.id)) {
        go('/classroom/booking-demo-live');
        return;
      }
      setBooking(found);
      setNotes(found?.notes || '');
      if (!found) setLoadError('এই ক্লাসের বুকিংটি পাওয়া যায়নি। বুকিং তালিকা থেকে ক্লাসে প্রবেশ করুন।');
    }).catch(() => { if (active) setLoadError('ক্লাসরুমের তথ্য লোড করা যায়নি। আবার চেষ্টা করুন।'); });
    return () => { active = false; };
  }, [bookingId, user.id]);

  const sendRoom = (payload: Record<string, unknown>) => {
    const socket = roomSocket.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ bookingId, ...payload }));
    return true;
  };

  const syncTrack = async (kind: 'audio' | 'video', track: MediaStreamTrack | null) => {
    const connection = peer.current;
    if (!connection || connection.connectionState === 'closed') return;
    let transceiver = connection.getTransceivers().find(item => (item.sender.track?.kind || item.receiver.track.kind) === kind);
    if (!transceiver) transceiver = connection.addTransceiver(kind, { direction: 'sendrecv' });
    await transceiver.sender.replaceTrack(track);
  };

  const makePeer = () => {
    if (peer.current && peer.current.connectionState !== 'closed' && peer.current.connectionState !== 'failed') return peer.current;
    if (peer.current) peer.current.close();
    peer.current = null;
    pendingIce.current = [];
    remoteStream.current = new MediaStream();
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
    const connection = new RTCPeerConnection({ iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ] });
    connection.addTransceiver('audio', { direction: 'sendrecv' });
    connection.addTransceiver('video', { direction: 'sendrecv' });
    for (const track of stream.current?.getTracks() || []) {
      const transceiver = connection.getTransceivers().find(item => (item.sender.track?.kind || item.receiver.track.kind) === track.kind);
      if (transceiver) void transceiver.sender.replaceTrack(track.enabled ? track : null);
    }
    connection.onicecandidate = event => { if (event.candidate) sendRoom({ type: 'classroom:ice', to: otherUserRef.current?.id, data: event.candidate.toJSON() }); };
    connection.ontrack = event => {
      // replaceTrack() on an addTransceiver() sender can produce streamless tracks.
      // Keep one receiver stream so a later audio/video track cannot replace the first.
      const incoming = remoteStream.current || (remoteStream.current = new MediaStream());
      for (const track of event.streams.flatMap(item => item.getTracks())) {
        if (!incoming.getTracks().some(existing => existing.id === track.id)) incoming.addTrack(track);
      }
      if (!incoming.getTracks().some(existing => existing.id === event.track.id)) incoming.addTrack(event.track);
      if (remoteVideo.current) {
        remoteVideo.current.srcObject = incoming;
        void remoteVideo.current.play().then(() => setNeedsAudioTap(false)).catch(() => setNeedsAudioTap(true));
      }
      if (event.track.kind === 'video') setRemoteCamera(!event.track.muted);
      if (event.track.kind === 'audio') setRemoteMic(!event.track.muted);
      event.track.onmute = () => { if (event.track.kind === 'video') setRemoteCamera(false); if (event.track.kind === 'audio') setRemoteMic(false); };
      event.track.onunmute = () => { if (event.track.kind === 'video') setRemoteCamera(true); if (event.track.kind === 'audio') setRemoteMic(true); };
      event.track.onended = () => {
        incoming.removeTrack(event.track);
        if (event.track.kind === 'video') setRemoteCamera(false);
        if (event.track.kind === 'audio') setRemoteMic(false);
      };
    };
    connection.onconnectionstatechange = () => {
      const state = connection.connectionState;
      setCallState(state === 'connected' ? 'connected' : state === 'failed' || state === 'disconnected' ? 'disconnected' : 'connecting');
      if (state === 'connected') { iceRestartAttempts.current = 0; setFeedback(''); }
      if (state === 'failed') {
        const otherId = otherUserRef.current?.id;
        if (otherId && user.id < otherId && iceRestartAttempts.current < 2) {
          iceRestartAttempts.current += 1;
          window.setTimeout(() => void startOffer(otherId, true), 700 * iceRestartAttempts.current);
        } else if (otherId) setFeedback('ভিডিও সংযোগ তৈরি হয়নি। আবার চেষ্টা করুন বা অন্য নেটওয়ার্ক ব্যবহার করুন।');
      }
    };
    peer.current = connection;
    return connection;
  };

  async function startOffer(otherId: string, iceRestart = false) {
    if (offerPending.current) return;
    offerPending.current = true;
    try {
      if (iceRestart && peer.current?.connectionState === 'failed') makePeer();
      const connection = makePeer();
      const offer = await connection.createOffer(iceRestart ? { iceRestart: true } : undefined);
      await connection.setLocalDescription(offer);
      sendRoom({ type: 'classroom:offer', to: otherId, data: connection.localDescription });
    } catch { setFeedback('ভিডিও কল শুরু করা যায়নি। আবার ক্লাসে যুক্ত হন।'); }
    finally { offerPending.current = false; }
  }

  const flushIce = async (connection: RTCPeerConnection) => {
    const queued = pendingIce.current.splice(0);
    for (const candidate of queued) await connection.addIceCandidate(candidate).catch(() => undefined);
  };

  useEffect(() => {
    if (!booking) return;
    let active = true;
    let retryTimer: number | undefined;
    let retryDelay = 1000;
    const connect = () => {
      if (!active) return;
      const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
      const socket = new WebSocket(`${protocol}://${location.host}/ws`);
      roomSocket.current = socket;
      socket.onopen = () => {
        if (!active) return;
        retryDelay = 1000;
        socket.send(JSON.stringify({ type: 'classroom:join', bookingId }));
      };
      socket.onmessage = event => {
        let packet: RoomPacket;
        try { packet = JSON.parse(event.data) as RoomPacket; } catch { return; }
        if (packet.type === 'classroom:joined') {
          const participants = packet.peers || [];
          const remote = participants[0];
          setPeerOnline(Boolean(remote));
          otherUserRef.current = remote?.user || null;
          setOtherUser(remote?.user || null);
          setRemoteCamera(remote?.camera || false); setRemoteMic(remote?.mic || false); setRemoteScreen(remote?.screen || false);
          if (packet.board) setBoard(packet.board);
          if (packet.chat) setChat(packet.chat);
          if (remote) {
            sendRoom({ type: 'classroom:media', ...mediaStateRef.current });
            if (user.id < remote.user.id) void startOffer(remote.user.id);
          }
        } else if (packet.type === 'classroom:peer-joined' && packet.user) {
          otherUserRef.current = packet.user;
          setOtherUser(packet.user); setPeerOnline(true); setCallState('connecting');
          sendRoom({ type: 'classroom:media', ...mediaStateRef.current });
          if (user.id < packet.user.id) void startOffer(packet.user.id);
        } else if (packet.type === 'classroom:peer-left' && packet.userId === otherUserRef.current?.id) {
          otherUserRef.current = null;
          setOtherUser(null); setPeerOnline(false); setRemoteCamera(false); setRemoteMic(false); setRemoteScreen(false); setCallState('waiting');
          peer.current?.close(); peer.current = null; pendingIce.current = [];
          remoteStream.current = new MediaStream(); setNeedsAudioTap(false);
          if (remoteVideo.current) remoteVideo.current.srcObject = null;
        } else if (packet.type === 'classroom:media' && packet.userId === otherUserRef.current?.id) {
          setRemoteCamera(Boolean(packet.camera)); setRemoteMic(Boolean(packet.mic)); setRemoteScreen(Boolean(packet.screen));
        } else if (packet.type === 'classroom:offer' && packet.data) {
          void (async () => {
            try { const connection = makePeer(); await connection.setRemoteDescription(packet.data! as RTCSessionDescriptionInit); await flushIce(connection); const answer = await connection.createAnswer(); await connection.setLocalDescription(answer); sendRoom({ type: 'classroom:answer', to: packet.fromId, data: connection.localDescription }); }
            catch { setFeedback('ভিডিও কলের সংযোগ স্থাপন করা যায়নি।'); }
          })();
        } else if (packet.type === 'classroom:answer' && packet.data) {
          void (async () => { try { const connection = makePeer(); await connection.setRemoteDescription(packet.data! as RTCSessionDescriptionInit); await flushIce(connection); } catch { setFeedback('ভিডিও কলের উত্তর পাওয়া যায়নি।'); } })();
        } else if (packet.type === 'classroom:ice' && packet.data) {
          const candidate = packet.data as RTCIceCandidateInit;
          if (peer.current?.remoteDescription) void peer.current.addIceCandidate(candidate).catch(() => undefined);
          else pendingIce.current.push(candidate);
        } else if (packet.type === 'classroom:board' && packet.board) setBoard(packet.board);
        else if (packet.type === 'classroom:chat' && packet.message && typeof packet.message !== 'string') {
          const incomingMessage = packet.message;
          setChat(current => current.some(item => item.id === incomingMessage.id) ? current : [...current, incomingMessage]);
        }
        else if (packet.type === 'classroom:error' || packet.type === 'error') setFeedback(packet.error || (typeof packet.message === 'string' ? packet.message : '') || packet.body || 'ক্লাসরুম সংযোগ পাওয়া যায়নি।');
      };
      socket.onclose = () => {
        if (!active) return;
        setPeerOnline(false); setCallState('disconnected');
        peer.current?.close(); peer.current = null; pendingIce.current = [];
        remoteStream.current = new MediaStream(); setNeedsAudioTap(false);
        if (remoteVideo.current) remoteVideo.current.srcObject = null;
        retryTimer = window.setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30000);
      };
      socket.onerror = () => socket.close();
    };
    connect();
    return () => {
      active = false;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      const socket = roomSocket.current;
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'classroom:leave', bookingId }));
      socket?.close(); roomSocket.current = null;
      peer.current?.close(); peer.current = null;
      remoteStream.current = null;
    };
  }, [booking?.id, bookingId, user.id]);

  useEffect(() => {
    if (recording === 'recording') {
      const timer = window.setInterval(() => setRecordSeconds(seconds => seconds + 1), 1000);
      return () => window.clearInterval(timer);
    }
  }, [recording]);

  useEffect(() => () => {
    stream.current?.getTracks().forEach(track => track.stop());
    displayStream.current?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    recorder.current?.state !== 'inactive' && recorder.current?.stop();
  }, []);
  useEffect(() => () => { if (recordUrl) URL.revokeObjectURL(recordUrl); }, [recordUrl]);

  const requestTracks = async (constraints: MediaStreamConstraints) => {
    const incoming = await navigator.mediaDevices.getUserMedia(constraints);
    if (!stream.current) stream.current = new MediaStream();
    for (const track of incoming.getTracks()) {
      stream.current.addTrack(track);
      await syncTrack(track.kind as 'audio' | 'video', track);
    }
    if (video.current && !sharing) video.current.srcObject = stream.current;
  };

  const cameraToggle = async () => {
    setFeedback(''); setMediaBusy(true);
    try {
      const track = stream.current?.getVideoTracks().find(item => item.readyState === 'live');
      if (camera) {
        if (track) { track.stop(); stream.current?.removeTrack(track); }
        if (!sharing) await syncTrack('video', null);
        if (video.current && !sharing) video.current.srcObject = stream.current;
        setCamera(false);
      } else {
        if (track) { track.enabled = true; if (!sharing) await syncTrack('video', track); }
        else await requestTracks({ video: true, audio: false });
        setCamera(true);
      }
      sendRoom({ type: 'classroom:media', camera: !camera, mic, screen: sharing });
    } catch { setFeedback('ক্যামেরা চালু হয়নি। ব্রাউজারের ক্যামেরা অনুমতি ও ডিভাইস সংযোগ পরীক্ষা করুন।'); }
    finally { setMediaBusy(false); }
  };

  const micToggle = async () => {
    setFeedback(''); setMediaBusy(true);
    try {
      const track = stream.current?.getAudioTracks().find(item => item.readyState === 'live');
      if (mic) {
        if (track) { track.stop(); stream.current?.removeTrack(track); }
        await syncTrack('audio', null); setMic(false);
      } else {
        if (track) { track.enabled = true; await syncTrack('audio', track); }
        else await requestTracks({ audio: true, video: false });
        setMic(true);
      }
      sendRoom({ type: 'classroom:media', camera, mic: !mic, screen: sharing });
    } catch { setFeedback('মাইক চালু হয়নি। ব্রাউজারের মাইক্রোফোন অনুমতি ও ডিভাইস সংযোগ পরীক্ষা করুন।'); }
    finally { setMediaBusy(false); }
  };

  const stopScreenShare = async () => {
    const displayed = displayStream.current; displayStream.current = null;
    if (displayed) displayed.getTracks().forEach(track => { track.onended = null; track.stop(); });
    const cameraTrack = camera ? stream.current?.getVideoTracks().find(track => track.readyState === 'live') || null : null;
    await syncTrack('video', cameraTrack);
    if (video.current) video.current.srcObject = stream.current;
    setSharing(false); sendRoom({ type: 'classroom:media', camera, mic, screen: false });
  };

  const toggleScreenShare = async () => {
    if (sharing) { await stopScreenShare(); return; }
    setFeedback('');
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      displayStream.current = display;
      const track = display.getVideoTracks()[0];
      if (video.current) video.current.srcObject = display;
      await syncTrack('video', track);
      track.onended = () => { void stopScreenShare(); };
      setSharing(true); sendRoom({ type: 'classroom:media', camera, mic, screen: true });
    } catch { displayStream.current?.getTracks().forEach(track => track.stop()); displayStream.current = null; setSharing(false); setFeedback('স্ক্রিন শেয়ার শুরু হয়নি। ব্রাউজারের স্ক্রিন শেয়ার অনুমতি দিন।'); }
  };

  const ensureMedia = async () => {
    const hasVideo = Boolean(stream.current?.getVideoTracks().some(track => track.readyState === 'live'));
    const hasAudio = Boolean(stream.current?.getAudioTracks().some(track => track.readyState === 'live'));
    const needsVideo = !hasVideo; const needsAudio = mic && !hasAudio;
    if (needsVideo || needsAudio) await requestTracks({ video: needsVideo, audio: needsAudio });
    if (needsVideo) { setCamera(true); sendRoom({ type: 'classroom:media', camera: true, mic, screen: sharing }); }
  };

  const toggleRecord = async () => {
    setFeedback('');
    if (recording === 'idle') {
      try {
        await ensureMedia();
        if (!stream.current?.getTracks().some(track => track.readyState === 'live')) throw new Error('ক্যামেরা বা মাইক চালু নেই');
        chunks.current = [];
        recorder.current = new MediaRecorder(stream.current);
        recorder.current.ondataavailable = event => { if (event.data.size) chunks.current.push(event.data); };
        recorder.current.onstop = () => {
          const url = URL.createObjectURL(new Blob(chunks.current, { type: 'video/webm' }));
          setRecordUrl(url); setRecording('done');
          if (user.role === 'TEACHER') void post(`/bookings/${bookingId}/recording`, { name: `ক্লাস রেকর্ডিং ${new Date().toLocaleDateString('bn-BD')}`, duration: recordSeconds });
        };
        recorder.current.start(); setRecording('recording');
      } catch { setFeedback('রেকর্ডিং শুরু হয়নি। ক্যামেরা অনুমতি ও ডিভাইস সংযোগ পরীক্ষা করুন।'); }
    } else if (recording === 'recording') { recorder.current?.pause(); setRecording('paused'); }
    else if (recording === 'paused') { recorder.current?.resume(); setRecording('recording'); }
  };

  const stopRecord = () => { if (['recording', 'paused'].includes(recording)) recorder.current?.stop(); };
  const saveNotes = async () => {
    if (user.role !== 'TEACHER') return;
    try { await post(`/bookings/${bookingId}/notes`, { notes }); setFeedback('ক্লাস নোট সংরক্ষিত হয়েছে।'); }
    catch { setFeedback('নোট সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।'); }
  };
  const end = async () => {
    if (user.role === 'TEACHER' && booking?.id !== 'booking-demo-live' && booking?.status !== 'COMPLETED') await post(`/bookings/${bookingId}/status`, { status: 'COMPLETED' });
    go('/bookings');
  };

  if (loadError) return <section className="classroom classroom-empty"><div><span aria-hidden="true">⌁</span><h1>ক্লাসরুমে প্রবেশ করা যাচ্ছে না</h1><p>{loadError}</p><button className="button" onClick={() => go('/bookings')}>বুকিং তালিকায় ফিরুন</button></div></section>;
  if (!booking) return <div className="classroom-loading"><Loading/></div>;
  const sessionStatus = callState === 'connected' ? 'লাইভ সংযোগ' : callState === 'connecting' ? 'সংযোগ হচ্ছে' : callState === 'disconnected' ? 'সংযোগ বিচ্ছিন্ন' : booking.status === 'COMPLETED' ? 'ক্লাস সম্পন্ন' : 'অংশগ্রহণকারীর অপেক্ষায়';
  const recordingActive = recording === 'recording' || recording === 'paused';
  const otherName = otherUser?.name || participantRole;

  return <section className="classroom">
    <header className="class-top">
      <div className="class-session-identity">
        <span className={`session-status${callState === 'connected' ? ' is-live' : ''}`}><i aria-hidden="true"/>{sessionStatus}</span>
        <div><b>ইন্টারঅ্যাকটিভ ক্লাসরুম</b><small>{shortDate(booking.date)} · {booking.time} · বুকিং #{booking.id.slice(-5)}</small></div>
      </div>
      <div className="class-session-actions">
        {recording !== 'idle' && <span className={`recording-timer${recordingActive ? ' is-recording' : ''}`}><i aria-hidden="true"/>{recording === 'done' ? 'রেকর্ড সম্পন্ন' : recording === 'paused' ? 'রেকর্ড বিরতিতে' : 'রেকর্ডিং'} <b>{String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:{String(recordSeconds % 60).padStart(2, '0')}</b></span>}
        <button className="danger-btn" onClick={() => void end()}><span aria-hidden="true">↗</span> {user.role === 'TEACHER' && booking.id !== 'booking-demo-live' ? 'ক্লাস শেষ করুন' : 'ক্লাস থেকে বের হন'}</button>
      </div>
    </header>

    <div className="class-grid">
      <div className="class-main">
        <div className="videos">
          <div className="video-tile alt participant-stage">
            <video ref={remoteVideo} autoPlay playsInline aria-label={`${otherName} এর লাইভ ভিডিও`}/>
            {!remoteCamera && !remoteScreen && <div className="participant-placeholder"><Avatar name={otherName} size="lg" photoUrl={otherUser ? photoFromUser(otherUser as User) : undefined}/><b>{otherName}</b><span>{peerOnline ? remoteMic ? 'ক্যামেরা বন্ধ · মাইক চালু' : 'ক্যামেরা ও মাইক বন্ধ' : 'অন্য অংশগ্রহণকারীর অপেক্ষায়'}</span></div>}
            {needsAudioTap && remoteMic && <button className="remote-audio-prompt" onClick={() => { void remoteVideo.current?.play().then(() => setNeedsAudioTap(false)).catch(() => setNeedsAudioTap(true)); }}>অন্য পাশের অডিও চালু করুন</button>}
            <span className="video-name-label">{otherName} · {remoteScreen ? 'স্ক্রিন শেয়ার' : participantRole}</span>
          </div>
          <div className="video-tile self-stage">
            <video ref={video} autoPlay muted playsInline aria-label="আপনার ক্যামেরার প্রিভিউ"/>
            {!camera && !sharing && <div className="self-video-placeholder"><Avatar name={user.name} size="md" photoUrl={photoFromUser(user)}/><span>আপনার ক্যামেরা বন্ধ</span></div>}
            <span className="video-name-label">{user.name} · {sharing ? 'স্ক্রিন শেয়ার' : 'আপনি'}</span>
          </div>
        </div>

        <div className="class-call-status" role="status"><span className={callState === 'connected' ? 'is-ready' : ''}/>{callState === 'connected' ? 'অডিও/ভিডিও সংযুক্ত' : peerOnline ? 'অংশগ্রহণকারী যুক্ত · মিডিয়া সংযোগ হচ্ছে' : 'অন্য অংশগ্রহণকারী যুক্ত হলে কল শুরু হবে'}{remoteMic && <small> · মাইক চালু</small>}</div>
        <div className="class-controls" aria-label="ক্লাস কন্ট্রোল">
          <button className={`class-control${camera ? ' is-active' : ''}`} aria-pressed={camera} disabled={mediaBusy} onClick={() => void cameraToggle()}><span aria-hidden="true">▣</span>{camera ? 'ক্যামেরা বন্ধ' : 'ক্যামেরা চালু'}</button>
          <button className={`class-control${mic ? ' is-active' : ''}`} aria-pressed={mic} disabled={mediaBusy} onClick={() => void micToggle()}><span aria-hidden="true">◖</span>{mic ? 'মাইক বন্ধ' : 'মাইক চালু'}</button>
          <button className={`class-control${sharing ? ' is-active' : ''}`} aria-pressed={sharing} onClick={() => void toggleScreenShare()}><span aria-hidden="true">⇧</span>{sharing ? 'শেয়ার বন্ধ' : 'স্ক্রিন শেয়ার'}</button>
          <button className={`class-control${recordingActive ? ' is-recording' : ''}`} disabled={recording === 'done'} onClick={() => void toggleRecord()}><span aria-hidden="true">●</span>{recording === 'idle' ? 'রেকর্ড শুরু' : recording === 'recording' ? 'বিরতি দিন' : recording === 'paused' ? 'চালিয়ে যান' : 'রেকর্ড সম্পন্ন'}</button>
          {recordingActive && <button className="class-control is-stop" onClick={stopRecord}><span aria-hidden="true">■</span>রেকর্ড থামান</button>}
        </div>
        {feedback && <p className="class-feedback" role="status">{feedback}<button onClick={() => setFeedback('')} aria-label="বার্তাটি বন্ধ করুন">×</button></p>}
        {recordUrl && <div className="recorded"><div><b>আপনার ক্লাস রেকর্ডিং</b><a className="quiet-btn" href={recordUrl} download="shikhok-class.webm">ভিডিও ডাউনলোড করুন ↓</a></div><video src={recordUrl} controls/></div>}

        <section className="workspace" aria-label="ক্লাসের কাজের জায়গা">
          <div className="tabs" role="tablist" aria-label="ক্লাস টুল">
            <button id="class-tab-board" role="tab" aria-selected={tab === 'board'} aria-controls="class-panel-board" className={tab === 'board' ? 'active' : ''} onClick={() => setTab('board')}><span aria-hidden="true">▤</span> হোয়াইটবোর্ড {peerOnline && <i className="board-live-dot" aria-label="লাইভ সিঙ্ক"/>}</button>
            <button id="class-tab-chat" role="tab" aria-selected={tab === 'chat'} aria-controls="class-panel-chat" className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}><span aria-hidden="true">◌</span> ক্লাস চ্যাট{chat.length > 0 && <i>{bn(chat.length)}</i>}</button>
            <button id="class-tab-notes" role="tab" aria-selected={tab === 'notes'} aria-controls="class-panel-notes" className={tab === 'notes' ? 'active' : ''} onClick={() => setTab('notes')}><span aria-hidden="true">▧</span> ক্লাস নোট</button>
          </div>
          {tab === 'board' ? <div id="class-panel-board" className="workspace-panel" role="tabpanel" aria-labelledby="class-tab-board"><Whiteboard bookingId={bookingId} value={board} onChange={next => { setBoard(next); sendRoom({ type: 'classroom:board', board: next }); }}/></div> : tab === 'chat' ? <div id="class-panel-chat" className="workspace-panel" role="tabpanel" aria-labelledby="class-tab-chat"><div className="class-chat"><div className="class-chat-messages" aria-live="polite">{chat.length ? chat.map(item => <p className={item.senderId === user.id ? 'mine' : ''} key={item.id}><b>{item.name}</b><span>{item.text}</span><time>{new Intl.DateTimeFormat('bn-BD', { hour: 'numeric', minute: '2-digit' }).format(new Date(item.createdAt))}</time></p>) : <Empty>ক্লাসের প্রশ্ন, উত্তর ও গুরুত্বপূর্ণ বার্তা এখানে লিখুন।</Empty>}</div><form onSubmit={event => { event.preventDefault(); if (!message.trim()) return; if (sendRoom({ type: 'classroom:chat', body: message.trim() })) setMessage(''); else setFeedback('ক্লাসের সংযোগ ফিরলে আবার বার্তা পাঠান।'); }}><input value={message} onChange={event => setMessage(event.target.value)} placeholder="ক্লাসে বার্তা লিখুন…" aria-label="ক্লাসে বার্তা লিখুন" maxLength={1000}/><button className="button" disabled={!message.trim()}>পাঠান <span aria-hidden="true">→</span></button></form></div></div> : <div id="class-panel-notes" className="workspace-panel" role="tabpanel" aria-labelledby="class-tab-notes"><div className="notes-editor">{user.role === 'TEACHER' ? <><label htmlFor="class-notes">আজকের পাঠ, সূত্র, বাড়ির কাজ ও পরবর্তী ক্লাসের প্রস্তুতি</label><textarea id="class-notes" value={notes} onChange={event => setNotes(event.target.value)} placeholder="ক্লাস নোট এখানে লিখুন…"/><button className="button" onClick={() => void saveNotes()}>নোট সংরক্ষণ করুন <span aria-hidden="true">✓</span></button></> : <p>{notes || 'শিক্ষক এখনও কোনো ক্লাস নোট যোগ করেননি।'}</p>}</div></div>}
        </section>
      </div>

      <aside className="participants">
        <div className="participants-heading"><div><p className="eyebrow">সেশন প্যানেল</p><h3>অংশগ্রহণকারী <span>২</span></h3></div><span className={`participants-ready${peerOnline ? '' : ' is-waiting'}`}><i aria-hidden="true"/>{peerOnline ? 'যুক্ত' : 'অপেক্ষায়'}</span></div>
        <div className="participant-list">
          <div className="participant-card"><Avatar name={user.name} size="sm" photoUrl={photoFromUser(user)}/><span><b>{user.name}</b><small>{user.role === 'TEACHER' ? 'শিক্ষক · আপনি' : 'শিক্ষার্থী · আপনি'}</small></span><i aria-label="আপনি ক্লাসে যুক্ত"/></div>
          <div className="participant-card"><Avatar name={otherName} size="sm" photoUrl={otherUser ? photoFromUser(otherUser as User) : undefined}/><span><b>{otherName}</b><small>{peerOnline ? remoteCamera ? 'ক্যামেরা চালু' : remoteMic ? 'মাইক চালু' : participantRole : 'অফলাইনে'}</small></span><i className={peerOnline ? '' : 'is-away'} aria-label={peerOnline ? 'ক্লাসে যুক্ত' : 'এখনো যুক্ত হননি'}/></div>
        </div>
        <div className="participant-attendance"><span>উপস্থিতি</span><b><i aria-hidden="true">✓</i> নথিভুক্ত হয়েছে</b><small>আপনি এই ক্লাসের অংশগ্রহণকারী।</small></div>
        <div className="participant-tip"><span aria-hidden="true">✦</span><p>একই সময়ে ক্যামেরা, মাইক, হোয়াইটবোর্ড ও ক্লাস চ্যাট ব্যবহার করুন।</p></div>
      </aside>
    </div>
  </section>;
}

function Whiteboard({ bookingId, value, onChange }: { bookingId: string; value: BoardState; onChange: (board: BoardState) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#164e63');
  const [size, setSize] = useState(4);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const draw = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const base = useRef<ImageData | null>(null);
  const history = useRef<string[]>([]);
  const redo = useRef<string[]>([]);

  const restore = (url: string) => {
    const c = canvas.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    if (!url || url === 'white') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); return; }
    const image = new Image(); image.onload = () => { ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(image, 0, 0, c.width, c.height); }; image.src = url;
  };

  useEffect(() => {
    const c = canvas.current; if (!c) return;
    if (!c.width) { c.width = 1000; c.height = 560; }
    restore(value.pages[value.page] || '');
  }, [value.page, value.pages]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current!; const rect = c.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (c.width / rect.width), y: (event.clientY - rect.top) * (c.height / rect.height) };
  };
  const publish = () => {
    const c = canvas.current; if (!c) return;
    const image = c.toDataURL('image/png');
    const pages = [...value.pages]; pages[value.page] = image;
    onChange({ pages, page: value.page });
    try { localStorage.setItem(`shikhok-board-${bookingId}`, JSON.stringify({ pages, page: value.page })); } catch { /* Shared server copy remains available. */ }
  };
  const begin = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current!; c.setPointerCapture(event.pointerId);
    if (!history.current.length) history.current.push(c.toDataURL('image/png'));
    const p = point(event); start.current = p; base.current = c.getContext('2d')!.getImageData(0, 0, c.width, c.height); draw.current = true;
    const ctx = c.getContext('2d')!; ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color; ctx.fillStyle = color; ctx.lineWidth = size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (tool === 'text') { const text = window.prompt('বোর্ডে কী লিখবেন?'); if (text) { ctx.font = `${Math.max(18, size * 5)}px sans-serif`; ctx.fillText(text, p.x, p.y); finish(); } draw.current = false; return; }
    if (tool === 'pen' || tool === 'eraser') { ctx.beginPath(); ctx.moveTo(p.x, p.y); }
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draw.current) return;
    const c = canvas.current!; const ctx = c.getContext('2d')!; const p = point(event);
    if (tool === 'pen' || tool === 'eraser') { ctx.lineTo(p.x, p.y); ctx.stroke(); return; }
    if (base.current) ctx.putImageData(base.current, 0, 0);
    ctx.strokeStyle = color; ctx.lineWidth = size; ctx.beginPath();
    if (tool === 'line') { ctx.moveTo(start.current.x, start.current.y); ctx.lineTo(p.x, p.y); }
    if (tool === 'rect') ctx.rect(start.current.x, start.current.y, p.x - start.current.x, p.y - start.current.y);
    if (tool === 'circle') { const radius = Math.hypot(p.x - start.current.x, p.y - start.current.y); ctx.arc(start.current.x, start.current.y, radius, 0, Math.PI * 2); }
    ctx.stroke();
  };
  const finish = () => {
    if (!draw.current && tool !== 'text') return;
    draw.current = false;
    const c = canvas.current; if (!c) return;
    history.current.push(c.toDataURL('image/png')); redo.current = []; setCanUndo(history.current.length > 1); setCanRedo(false); publish();
  };
  const clear = () => { const c = canvas.current!; const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); history.current.push(c.toDataURL('image/png')); redo.current = []; setCanUndo(history.current.length > 1); setCanRedo(false); publish(); };
  const undo = () => { if (history.current.length < 2) return; redo.current.unshift(history.current.pop()!); const previous = history.current[history.current.length - 1]; restore(previous); setCanUndo(history.current.length > 1); setCanRedo(true); const pages = [...value.pages]; pages[value.page] = previous; onChange({ pages, page: value.page }); };
  const redoDraw = () => { const next = redo.current.shift(); if (!next) return; history.current.push(next); restore(next); setCanUndo(true); setCanRedo(redo.current.length > 0); const pages = [...value.pages]; pages[value.page] = next; onChange({ pages, page: value.page }); };
  const nextPage = () => { if (value.pages.length >= 8) return; const pages = [...value.pages]; pages[value.page] = canvas.current?.toDataURL('image/png') || pages[value.page]; pages.push(''); onChange({ pages, page: pages.length - 1 }); history.current = []; redo.current = []; setCanUndo(false); setCanRedo(false); };
  const switchPage = (index: number) => { const pages = [...value.pages]; pages[value.page] = canvas.current?.toDataURL('image/png') || pages[value.page]; onChange({ pages, page: index }); history.current = []; redo.current = []; setCanUndo(false); setCanRedo(false); };

  return <div className="whiteboard"><div className="board-tools"><select value={tool} onChange={event => setTool(event.target.value)} aria-label="হোয়াইটবোর্ডের টুল"><option value="pen">কলম</option><option value="eraser">ইরেজার</option><option value="text">টেক্সট</option><option value="line">রেখা</option><option value="rect">আয়তক্ষেত্র</option><option value="circle">বৃত্ত</option></select><input type="color" aria-label="রঙ নির্বাচন" value={color} onChange={event => setColor(event.target.value)}/><label className="board-size-label">আকার<input type="range" aria-label="কলমের আকার" min="1" max="20" value={size} onChange={event => setSize(Number(event.target.value))}/></label><button type="button" disabled={!canUndo} onClick={undo}>পূর্বাবস্থায়</button><button type="button" disabled={!canRedo} onClick={redoDraw}>পুনরায়</button><button type="button" onClick={clear}>মুছুন</button><button type="button" disabled={value.pages.length >= 8} onClick={nextPage}>নতুন পাতা</button><span className="board-sync-state"><i/> {value.pages[value.page] ? 'সিঙ্ক করা' : 'লাইভ বোর্ড'}</span></div><canvas ref={canvas} onPointerDown={begin} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} aria-label="লাইভ ইন্টারঅ্যাকটিভ হোয়াইটবোর্ড"/><div className="page-pills">{value.pages.map((_, index) => <button type="button" className={index === value.page ? 'active' : ''} key={index} onClick={() => switchPage(index)}>পাতা {bn(index + 1)}</button>)}</div></div>;
}
