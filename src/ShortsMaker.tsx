import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Film,
  Image as ImageIcon,
  Music2,
  Pause,
  Play,
  Trash2,
  Upload,
  Clapperboard,
  Loader2,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

// Output canvas: 9:16 vertical video (TikTok / Shorts / Reels)
const W = 1080;
const H = 1920;
const BAND = 400; // height of the fixed hook-title band at the top
const FPS = 30;
const FONT = '"Black Han Sans", "Plus Jakarta Sans", sans-serif';
const PLACEHOLDER_DURATION = 6;

interface Clip {
  id: string;
  kind: 'video' | 'image';
  name: string;
  url: string;
  duration: number;
  el: HTMLVideoElement | HTMLImageElement;
}

interface Settings {
  titleTop: string;
  titleBottom: string;
  script: string;
  adBadge: boolean;
  endTitle: string;
  endDuration: number;
}

const DEFAULT_SETTINGS: Settings = {
  titleTop: '도파민 터지는',
  titleBottom: '타워 디펜스',
  script: [
    '3분 안에 도파민',
    '터지는 게임이라는데',
    '그래픽은?',
    '하기도 좋다?',
    '전략성도 있어?',
    '외출하거나',
    '바쁠 때도',
    '한 판 한 판이',
    '부담이 안 되고',
    '그 쾌감이',
    '미쳤다',
  ].join('\n'),
  adBadge: true,
  endTitle: '갑자기\n쇼츠',
  endDuration: 2,
};

// --- Timeline helpers ---

function getMainDuration(clips: Clip[]) {
  return clips.length ? clips.reduce((sum, c) => sum + c.duration, 0) : PLACEHOLDER_DURATION;
}

function getTotalDuration(clips: Clip[], s: Settings) {
  return getMainDuration(clips) + (s.endTitle.trim() ? s.endDuration : 0);
}

function getCaptions(s: Settings) {
  return s.script.split('\n').map(l => l.trim()).filter(Boolean);
}

function locateClip(clips: Clip[], t: number) {
  let start = 0;
  for (let i = 0; i < clips.length; i++) {
    if (t < start + clips[i].duration || i === clips.length - 1) {
      return { index: i, local: Math.max(0, t - start) };
    }
    start += clips[i].duration;
  }
  return { index: -1, local: 0 };
}

// --- Canvas drawing helpers ---

function mediaSize(el: HTMLVideoElement | HTMLImageElement) {
  return el instanceof HTMLVideoElement
    ? { w: el.videoWidth, h: el.videoHeight }
    : { w: el.naturalWidth, h: el.naturalHeight };
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  el: HTMLVideoElement | HTMLImageElement,
  x: number, y: number, w: number, h: number,
  zoom = 1
) {
  const { w: sw, h: sh } = mediaSize(el);
  if (!sw || !sh) return;
  const s = Math.max(w / sw, h / sh) * zoom;
  const dw = sw * s;
  const dh = sh * s;
  ctx.drawImage(el, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, size: number, maxWidth: number) {
  let s = size;
  ctx.font = `${s}px ${FONT}`;
  while (ctx.measureText(text).width > maxWidth && s > 24) {
    s -= 4;
    ctx.font = `${s}px ${FONT}`;
  }
  return s;
}

function outlinedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { size: number; fill: string | CanvasGradient; stroke?: string; strokeRatio?: number; maxWidth?: number; shadow?: boolean }
) {
  const size = fitFont(ctx, text, opts.size, opts.maxWidth ?? W - 80);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.lineWidth = size * (opts.strokeRatio ?? 0.22);
  ctx.strokeStyle = opts.stroke ?? '#000';
  if (opts.shadow) {
    // Chunky drop shadow like the reference title
    ctx.save();
    ctx.translate(0, size * 0.09);
    ctx.strokeText(text, x, y);
    ctx.fillStyle = '#000';
    ctx.fillText(text, x, y);
    ctx.restore();
  }
  ctx.strokeText(text, x, y);
  ctx.fillStyle = opts.fill;
  ctx.fillText(text, x, y);
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, t: number) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#1b5e20');
  g.addColorStop(1, '#0d2b4a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#fff';
  const offset = (t * 120) % 160;
  for (let x = -H; x < W + H; x += 160) {
    ctx.beginPath();
    ctx.moveTo(x + offset, 0);
    ctx.lineTo(x + offset + 80, 0);
    ctx.lineTo(x + offset + 80 - H, H);
    ctx.lineTo(x + offset - H, H);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `56px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('영상 / 이미지 클립을 추가하세요', W / 2, H - 260);
}

function drawEndCard(ctx: CanvasRenderingContext2D, text: string, local: number) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return;

  ctx.fillStyle = `rgba(0,0,0,${Math.min(0.45, local * 1.5)})`;
  ctx.fillRect(0, 0, W, H);

  // Pop-in with a little overshoot
  const p = Math.min(1, local / 0.35);
  const scale = p < 1 ? 0.3 + 0.9 * p - 0.2 * Math.sin(p * Math.PI) : 1 + 0.02 * Math.sin(local * 6);

  ctx.save();
  ctx.translate(W / 2, H * 0.55);
  ctx.rotate(-0.1);
  ctx.scale(scale, scale);

  const size = 250;
  const lineH = size * 1.05;
  const top = -((lines.length - 1) * lineH) / 2;
  const palettes = [
    ['#d4ff3a', '#2fbf1f'],
    ['#ffd23a', '#ff4b1f'],
  ];
  lines.forEach((line, i) => {
    const y = top + i * lineH;
    const [c1, c2] = palettes[i % palettes.length];
    const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    // White outer rim, then thick black outline, then gradient fill
    const s = fitFont(ctx, line, size, W - 60);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = s * 0.42;
    ctx.strokeStyle = '#fff';
    ctx.strokeText(line, 0, y + s * 0.06);
    ctx.lineWidth = s * 0.26;
    ctx.strokeStyle = '#111';
    ctx.strokeText(line, 0, y);
    ctx.fillStyle = g;
    ctx.fillText(line, 0, y);
  });
  ctx.restore();
}

function renderFrame(ctx: CanvasRenderingContext2D, t: number, clips: Clip[], s: Settings) {
  const main = getMainDuration(clips);
  const inEnd = t >= main;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // Background media: blurred full-frame copy behind the title band, sharp copy below it
  const { index, local } = locateClip(clips, Math.min(t, main - 0.001));
  const clip = index >= 0 ? clips[index] : null;
  if (clip) {
    ctx.save();
    ctx.filter = 'blur(36px) brightness(0.75) saturate(1.2)';
    drawCover(ctx, clip.el, -60, -60, W + 120, H + 120);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, BAND, W, H - BAND);
    ctx.clip();
    const zoom = 1 + 0.07 * Math.min(1, local / clip.duration); // slow push-in per clip
    drawCover(ctx, clip.el, 0, BAND, W, H - BAND, zoom);
    ctx.restore();
  } else {
    drawPlaceholder(ctx, t);
  }

  if (inEnd) {
    drawEndCard(ctx, s.endTitle, t - main);
  } else {
    // Center captions: one short phrase at a time, popping in
    const captions = getCaptions(s);
    if (captions.length) {
      const per = main / captions.length;
      const ci = Math.min(captions.length - 1, Math.floor(t / per));
      const cl = t - ci * per;
      const pop = cl < 0.12 ? 1.25 - (cl / 0.12) * 0.25 : 1;
      ctx.save();
      ctx.translate(W / 2, BAND + (H - BAND) * 0.42);
      ctx.scale(pop, pop);
      outlinedText(ctx, captions[ci], 0, 0, { size: 104, fill: '#fff', strokeRatio: 0.2, maxWidth: W - 120 });
      ctx.restore();
    }
  }

  // Title band: soft dark gradient for legibility, then the two-line hook title
  const g = ctx.createLinearGradient(0, 0, 0, BAND);
  g.addColorStop(0, 'rgba(0,0,0,0.35)');
  g.addColorStop(1, 'rgba(0,0,0,0.05)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, BAND);
  if (s.titleTop.trim()) {
    outlinedText(ctx, s.titleTop.trim(), W / 2, BAND * 0.33, { size: 150, fill: '#ffffff', strokeRatio: 0.2, shadow: true });
  }
  if (s.titleBottom.trim()) {
    outlinedText(ctx, s.titleBottom.trim(), W / 2, BAND * 0.74, { size: 150, fill: '#ffe53b', strokeRatio: 0.2, shadow: true });
  }

  if (s.adBadge) {
    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = `52px ${FONT}`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#000';
    ctx.strokeText('유료 광고 포함', W - 30, BAND + 24);
    ctx.fillStyle = '#ffe53b';
    ctx.fillText('유료 광고 포함', W - 30, BAND + 24);
    ctx.restore();
  }
}

function pickMimeType() {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  return candidates.find(c => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) ?? '';
}

function formatTime(sec: number) {
  return `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`;
}

// --- Component ---

export default function ShortsMaker() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const timeLabelRef = useRef<HTMLSpanElement>(null);

  const [clips, setClips] = useState<Clip[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [audio, setAudio] = useState<{ name: string; url: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [output, setOutput] = useState<{ url: string; ext: string } | null>(null);

  // Refs so the animation loop always sees the latest state
  const clipsRef = useRef(clips);
  const settingsRef = useRef(settings);
  clipsRef.current = clips;
  settingsRef.current = settings;

  const rafRef = useRef(0);
  const startRef = useRef(0);
  const activeClipRef = useRef(-1);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const total = getTotalDuration(clips, settings);

  const drawStill = (t = 0.5) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const cs = clipsRef.current;
    const { index, local } = locateClip(cs, t);
    const clip = cs[index];
    if (clip && clip.el instanceof HTMLVideoElement && clip.el.readyState >= 1) {
      clip.el.currentTime = Math.min(local, (clip.el.duration || local) - 0.05);
      clip.el.addEventListener('seeked', () => renderFrame(ctx, t, clipsRef.current, settingsRef.current), { once: true });
    }
    renderFrame(ctx, t, cs, settingsRef.current);
  };

  // Redraw the still preview whenever inputs change (and once the display font has loaded)
  useEffect(() => {
    if (isPlaying) return;
    drawStill();
    if (timeLabelRef.current) timeLabelRef.current.textContent = `0:00 / ${formatTime(total)}`;
  }, [clips, settings, isPlaying]);

  useEffect(() => {
    document.fonts?.load(`100px "Black Han Sans"`).then(() => drawStill()).catch(() => {});
    return () => stopPlayback();
  }, []);

  const stopPlayback = () => {
    cancelAnimationFrame(rafRef.current);
    clipsRef.current.forEach(c => c.el instanceof HTMLVideoElement && c.el.pause());
    audioElRef.current?.pause();
    audioElRef.current = null;
    activeClipRef.current = -1;
    setIsPlaying(false);
  };

  const startPlayback = (onFinish?: () => void, audioEl?: HTMLAudioElement | null) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    stopPlayback();
    setIsPlaying(true);
    activeClipRef.current = -1;
    audioElRef.current = audioEl ?? null;
    audioEl?.play().catch(() => {});
    startRef.current = performance.now();

    const tick = () => {
      const cs = clipsRef.current;
      const s = settingsRef.current;
      const totalDur = getTotalDuration(cs, s);
      const t = (performance.now() - startRef.current) / 1000;
      if (t >= totalDur) {
        renderFrame(ctx, totalDur - 0.001, cs, s);
        stopPlayback();
        onFinish?.();
        return;
      }

      const main = getMainDuration(cs);
      const { index } = locateClip(cs, Math.min(t, main - 0.001));
      if (index !== activeClipRef.current) {
        const prev = cs[activeClipRef.current];
        if (prev?.el instanceof HTMLVideoElement) prev.el.pause();
        const next = cs[index];
        if (next?.el instanceof HTMLVideoElement) {
          next.el.currentTime = 0;
          next.el.play().catch(() => {});
        }
        activeClipRef.current = index;
      }

      renderFrame(ctx, t, cs, s);
      if (progressRef.current) progressRef.current.style.width = `${(t / totalDur) * 100}%`;
      if (timeLabelRef.current) timeLabelRef.current.textContent = `${formatTime(t)} / ${formatTime(totalDur)}`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const togglePreview = () => {
    if (isPlaying) {
      if (isRecording) return;
      stopPlayback();
    } else {
      startPlayback(undefined, audio ? new Audio(audio.url) : null);
    }
  };

  const handleRecord = async () => {
    const canvas = canvasRef.current;
    if (!canvas || isRecording) return;
    if (output) URL.revokeObjectURL(output.url);
    setOutput(null);

    const stream = canvas.captureStream(FPS);
    let audioEl: HTMLAudioElement | null = null;
    if (audio) {
      audioEl = new Audio(audio.url);
      const actx = new AudioContext();
      audioCtxRef.current = actx;
      const src = actx.createMediaElementSource(audioEl);
      const dest = actx.createMediaStreamDestination();
      src.connect(dest);
      src.connect(actx.destination);
      dest.stream.getAudioTracks().forEach(tr => stream.addTrack(tr));
    }

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 8_000_000 } : undefined);
    recorderRef.current = recorder;
    const chunks: Blob[] = [];
    recorder.ondataavailable = e => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      const type = recorder.mimeType || mimeType || 'video/webm';
      const blob = new Blob(chunks, { type });
      setOutput({ url: URL.createObjectURL(blob), ext: type.includes('mp4') ? 'mp4' : 'webm' });
      setIsRecording(false);
      stream.getTracks().forEach(tr => tr.stop());
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
    };

    setIsRecording(true);
    recorder.start(250);
    startPlayback(() => recorder.state !== 'inactive' && recorder.stop(), audioEl);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      const url = URL.createObjectURL(file);
      const id = Math.random().toString(36).slice(2, 11);
      if (file.type.startsWith('video/')) {
        const v = document.createElement('video');
        v.muted = true;
        v.playsInline = true;
        v.loop = true;
        v.preload = 'auto';
        v.src = url;
        v.addEventListener('loadeddata', () => {
          const duration = Math.max(1, Math.min(4, Math.round(v.duration * 10) / 10 || 3));
          setClips(prev => [...prev, { id, kind: 'video', name: file.name, url, duration, el: v }]);
        }, { once: true });
        v.addEventListener('error', () => {
          URL.revokeObjectURL(url);
          alert(`이 브라우저에서 재생할 수 없는 영상 형식입니다: ${file.name}`);
        }, { once: true });
      } else if (file.type.startsWith('image/')) {
        const img = new Image();
        img.src = url;
        img.onload = () => setClips(prev => [...prev, { id, kind: 'image', name: file.name, url, duration: 2.5, el: img }]);
      }
    });
  };

  const handleAudio = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (audio) URL.revokeObjectURL(audio.url);
    setAudio({ name: file.name, url: URL.createObjectURL(file) });
  };

  const updateClip = (id: string, duration: number) =>
    setClips(prev => prev.map(c => (c.id === id ? { ...c, duration } : c)));

  const removeClip = (id: string) =>
    setClips(prev => {
      const c = prev.find(x => x.id === id);
      if (c) URL.revokeObjectURL(c.url);
      return prev.filter(x => x.id !== id);
    });

  const moveClip = (id: string, dir: -1 | 1) =>
    setClips(prev => {
      const i = prev.findIndex(x => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings(prev => ({ ...prev, [key]: value }));

  const captions = getCaptions(settings);
  const perCaption = captions.length ? getMainDuration(clips) / captions.length : 0;
  const busy = isRecording;

  return (
    <div className="min-h-screen bg-[#080808] text-white font-sans selection:bg-tiktok-pink selection:text-white">
      <header className="h-20 border-b border-zinc-900 px-6 md:px-8 flex items-center justify-between bg-[#080808]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link to="/" className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-900 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Clapperboard className="text-tiktok-pink" /> Shorts Maker
          </h2>
        </div>
        <span className="hidden md:block text-zinc-500 text-sm">후킹 제목 + 중앙 자막 + 엔딩 로고 스타일 숏폼 만들기</span>
      </header>

      <div className="p-6 md:p-8 grid grid-cols-1 xl:grid-cols-12 gap-8 max-w-[1600px] mx-auto">
        {/* Left: editor */}
        <div className="xl:col-span-7 flex flex-col gap-8">
          <section className="bg-zinc-900/40 border border-zinc-800 p-8 rounded-3xl">
            <h3 className="text-xl font-bold mb-6">1. 상단 후킹 제목</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-zinc-500 ml-1">첫 줄 (흰색)</label>
                <input
                  value={settings.titleTop}
                  onChange={e => set('titleTop', e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-4 focus:border-tiktok-cyan focus:outline-none transition-all"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-zinc-500 ml-1">둘째 줄 (노란색)</label>
                <input
                  value={settings.titleBottom}
                  onChange={e => set('titleBottom', e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-4 focus:border-tiktok-cyan focus:outline-none transition-all"
                />
              </div>
            </div>
            <label className="flex items-center gap-3 mt-6 text-sm text-zinc-400 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={settings.adBadge}
                onChange={e => set('adBadge', e.target.checked)}
                className="w-4 h-4 accent-tiktok-pink"
              />
              "유료 광고 포함" 표시
            </label>
          </section>

          <section className="bg-zinc-900/40 border border-zinc-800 p-8 rounded-3xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">2. 클립</h3>
              <span className="text-zinc-500 text-sm">총 {getMainDuration(clips).toFixed(1)}초</span>
            </div>
            <label
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
              className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-zinc-800 hover:border-tiktok-cyan rounded-2xl py-10 cursor-pointer transition-all text-zinc-500"
            >
              <Upload className="w-8 h-8" />
              <span className="font-semibold">영상 / 이미지 파일을 끌어오거나 클릭</span>
              <span className="text-xs">게임 플레이 녹화, 캐릭터 이미지 등 — 순서대로 이어 붙여집니다</span>
              <input type="file" accept="video/*,image/*" multiple className="hidden" onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
            </label>

            {clips.length > 0 && (
              <ul className="mt-6 flex flex-col gap-3">
                {clips.map((c, i) => (
                  <li key={c.id} className="flex items-center gap-4 bg-zinc-950/50 rounded-2xl p-3">
                    <div className="w-12 h-16 rounded-lg overflow-hidden bg-zinc-900 shrink-0 border border-zinc-800">
                      {c.kind === 'image'
                        ? <img src={c.url} alt="" className="w-full h-full object-cover" />
                        : <video src={c.url} muted className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className="text-sm text-zinc-300 truncate flex items-center gap-2">
                        {c.kind === 'video' ? <Film className="w-4 h-4 text-zinc-600 shrink-0" /> : <ImageIcon className="w-4 h-4 text-zinc-600 shrink-0" />}
                        {c.name}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="range"
                          min={0.5}
                          max={c.kind === 'video' ? Math.max(1, Math.floor(((c.el as HTMLVideoElement).duration || 10) * 10) / 10) : 8}
                          step={0.1}
                          value={c.duration}
                          disabled={busy}
                          onChange={e => updateClip(c.id, Number(e.target.value))}
                          className="flex-grow accent-tiktok-cyan"
                        />
                        <span className="text-xs font-mono text-zinc-400 w-12 text-right">{c.duration.toFixed(1)}s</span>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <button disabled={busy || i === 0} onClick={() => moveClip(c.id, -1)} className="p-1 text-zinc-500 hover:text-white disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                      <button disabled={busy || i === clips.length - 1} onClick={() => moveClip(c.id, 1)} className="p-1 text-zinc-500 hover:text-white disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                    </div>
                    <button disabled={busy} onClick={() => removeClip(c.id)} className="p-2 text-zinc-500 hover:text-tiktok-pink transition-colors disabled:opacity-30">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-zinc-900/40 border border-zinc-800 p-8 rounded-3xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">3. 중앙 자막</h3>
              <span className="text-zinc-500 text-sm">
                {captions.length}줄 · 줄당 {perCaption.toFixed(2)}초
              </span>
            </div>
            <textarea
              value={settings.script}
              onChange={e => set('script', e.target.value)}
              rows={10}
              placeholder={'한 줄에 한 마디씩 짧게\n예) 그래픽은?\n하기도 좋다?'}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-6 focus:border-tiktok-cyan focus:outline-none transition-all resize-none leading-relaxed"
            />
            <p className="text-xs text-zinc-600 mt-3">한 줄이 한 컷 자막이 됩니다. 클립 전체 길이에 맞춰 균등하게 나눠 표시돼요.</p>
          </section>

          <section className="bg-zinc-900/40 border border-zinc-800 p-8 rounded-3xl">
            <h3 className="text-xl font-bold mb-6">4. 엔딩 로고 & 음성</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-zinc-500 ml-1">엔딩 타이틀 (줄바꿈 = 두 줄 로고, 비우면 생략)</label>
                <textarea
                  value={settings.endTitle}
                  onChange={e => set('endTitle', e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 focus:border-tiktok-cyan focus:outline-none transition-all resize-none"
                />
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-zinc-500 w-16">길이</span>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={0.5}
                    value={settings.endDuration}
                    disabled={busy}
                    onChange={e => set('endDuration', Number(e.target.value))}
                    className="flex-grow accent-tiktok-cyan"
                  />
                  <span className="text-xs font-mono text-zinc-400 w-12 text-right">{settings.endDuration.toFixed(1)}s</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-zinc-500 ml-1">내레이션 / BGM (선택)</label>
                <label className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 hover:border-tiktok-cyan rounded-2xl py-4 px-4 cursor-pointer transition-all">
                  <Music2 className="w-5 h-5 text-zinc-600 shrink-0" />
                  <span className="text-sm text-zinc-400 truncate">{audio ? audio.name : '오디오 파일 선택'}</span>
                  <input type="file" accept="audio/*" className="hidden" onChange={e => { handleAudio(e.target.files); e.target.value = ''; }} />
                </label>
                {audio && (
                  <button disabled={busy} onClick={() => { URL.revokeObjectURL(audio.url); setAudio(null); }} className="text-xs text-zinc-500 hover:text-tiktok-pink w-fit ml-1">
                    오디오 제거
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Right: preview & export */}
        <div className="xl:col-span-5 flex flex-col items-center">
          <div className="sticky top-28 w-full max-w-[380px]">
            <div className="relative aspect-[9/16] w-full bg-zinc-950 rounded-[2rem] border-[6px] border-zinc-900 overflow-hidden shadow-[0_0_80px_rgba(254,44,85,0.08)]">
              <canvas ref={canvasRef} width={W} height={H} className="w-full h-full" />
              {isRecording && (
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 px-3 py-1 rounded-full text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-tiktok-pink animate-pulse" /> REC
                </div>
              )}
            </div>

            <div className="mt-4 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
              <div ref={progressRef} className="h-full bg-tiktok-cyan" style={{ width: isPlaying ? undefined : '0%' }} />
            </div>
            <div className="flex justify-between text-xs text-zinc-500 mt-2 font-mono">
              <span ref={timeLabelRef} />
              <span>1080×1920 · {FPS}fps</span>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={togglePreview}
                disabled={busy}
                className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full py-4 font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
              >
                {isPlaying && !busy ? <><Pause className="w-4 h-4" /> 정지</> : <><Play className="w-4 h-4" /> 미리보기</>}
              </button>
              <button
                onClick={handleRecord}
                disabled={busy}
                className="flex-1 bg-tiktok-pink hover:bg-tiktok-pink/90 rounded-full py-4 font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(254,44,85,0.3)] disabled:opacity-60"
              >
                {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> 렌더링 중…</> : <><Clapperboard className="w-4 h-4" /> 영상 만들기</>}
              </button>
            </div>

            {output && (
              <a
                href={output.url}
                download={`shorts-${Date.now()}.${output.ext}`}
                className="mt-3 w-full bg-white text-tiktok-black hover:bg-tiktok-cyan rounded-full py-4 font-bold flex items-center justify-center gap-2 transition-all"
              >
                <Download className="w-4 h-4" /> 다운로드 (.{output.ext})
              </a>
            )}

            <p className="text-zinc-600 text-xs mt-6 text-center px-4 leading-relaxed">
              영상은 브라우저에서 실시간으로 녹화됩니다. 렌더링 중에는 이 탭을 열어 두세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
