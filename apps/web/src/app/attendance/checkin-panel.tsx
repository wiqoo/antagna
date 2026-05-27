'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, MapPin, Check, AlertTriangle, RefreshCw, LogIn } from 'lucide-react';
import { checkIn } from './actions';

type Coords = { lat: number; lng: number; acc: number };

const TYPES: { value: string; label: string }[] = [
  { value: 'check_in_office', label: 'حضور — مكتب' },
  { value: 'check_out_office', label: 'انصراف — مكتب' },
  { value: 'check_in_shoot', label: 'حضور — موقع تصوير' },
  { value: 'check_out_shoot', label: 'انصراف — موقع تصوير' },
];

export function CheckInPanel() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [type, setType] = useState('check_in_office');
  const [cameraOn, setCameraOn] = useState(false);
  const [photo, setPhoto] = useState<{ url: string; blob: Blob } | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const startCamera = async () => {
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      setResult({ ok: false, text: 'تعذّر فتح الكاميرا — تأكّد من السماح بالوصول.' });
    }
  };

  const stopCamera = () => {
    const s = videoRef.current?.srcObject as MediaStream | null;
    s?.getTracks().forEach((t) => t.stop());
    setCameraOn(false);
  };

  const capture = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    const size = Math.min(v.videoWidth, v.videoHeight) || 480;
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    // center-crop square
    const sx = (v.videoWidth - size) / 2;
    const sy = (v.videoHeight - size) / 2;
    ctx.drawImage(v, sx, sy, size, size, 0, 0, size, size);
    c.toBlob(
      (blob) => {
        if (blob) setPhoto({ url: URL.createObjectURL(blob), blob });
      },
      'image/jpeg',
      0.85,
    );
    stopCamera();
  };

  const getLocation = () => {
    setGeoErr(null);
    if (!('geolocation' in navigator)) {
      setGeoErr('الموقع غير مدعوم على هذا الجهاز');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: pos.coords.accuracy,
        }),
      () => setGeoErr('تعذّر تحديد الموقع — فعّل صلاحية الموقع.'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const reset = () => {
    setPhoto(null);
    setCoords(null);
    setResult(null);
    setGeoErr(null);
  };

  const submit = () => {
    if (!photo) return;
    start(async () => {
      const fd = new FormData();
      fd.append('selfie', new File([photo.blob], 'selfie.jpg', { type: 'image/jpeg' }));
      fd.append('type', type);
      if (coords) {
        fd.append('lat', String(coords.lat));
        fd.append('lng', String(coords.lng));
        fd.append('accuracy', String(coords.acc));
      }
      fd.append('clientTs', new Date().toISOString());
      const res = await checkIn(fd);
      if (res.ok) {
        setResult({
          ok: true,
          text:
            res.verification === 'verified'
              ? `تم التسجيل ✓${res.fence ? ` — ${res.fence}` : ''}`
              : 'سُجّل، لكن الموقع خارج النطاق المحدّد (سيُراجَع).',
        });
        setPhoto(null);
        setCoords(null);
        router.refresh();
      } else {
        setResult({ ok: false, text: res.error ?? 'تعذّر التسجيل' });
      }
    });
  };

  const inputCls =
    'h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-[14px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none';

  return (
    <div className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-[12px] text-[var(--text-muted)]">نوع التسجيل</span>
        <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      {/* Camera / photo */}
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt="selfie" className="h-full w-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className={'h-full w-full object-cover ' + (cameraOn ? '' : 'hidden')}
          />
        )}
        {!photo && !cameraOn && (
          <div className="absolute inset-0 grid place-items-center text-[var(--text-dim)]">
            <Camera size={40} />
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex flex-wrap gap-2">
        {!cameraOn && !photo && (
          <button onClick={startCamera} className="btn-secondary">
            <Camera size={15} /> افتح الكاميرا
          </button>
        )}
        {cameraOn && (
          <button onClick={capture} className="btn-primary">
            <Camera size={15} /> التقاط
          </button>
        )}
        {photo && (
          <button onClick={reset} className="btn-secondary">
            <RefreshCw size={15} /> إعادة
          </button>
        )}
        <button onClick={getLocation} className="btn-secondary">
          <MapPin size={15} /> {coords ? 'تحديث الموقع' : 'حدّد موقعي'}
        </button>
      </div>

      {/* Location status */}
      <div className="text-[12px]">
        {coords ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-400">
            <MapPin size={12} /> الموقع محدَّد (±{Math.round(coords.acc)}م)
          </span>
        ) : geoErr ? (
          <span className="inline-flex items-center gap-1.5 text-[var(--warning)]">
            <AlertTriangle size={12} /> {geoErr}
          </span>
        ) : (
          <span className="text-[var(--text-dim)]">لم يُحدَّد الموقع بعد.</span>
        )}
      </div>

      <button onClick={submit} disabled={!photo || pending} className="btn-primary w-full justify-center">
        <LogIn size={15} /> {pending ? 'يُسجّل…' : 'تسجيل الحضور'}
      </button>

      {result && (
        <p
          className={
            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] ' +
            (result.ok
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-red-500/30 bg-red-500/10 text-red-300')
          }
        >
          {result.ok ? <Check size={14} /> : <AlertTriangle size={14} />} {result.text}
        </p>
      )}

      <style>{`
        .btn-primary { display:inline-flex; align-items:center; gap:6px; border-radius:10px; background:var(--accent); color:#000; font-weight:600; font-size:13px; padding:8px 14px; }
        .btn-primary:disabled { opacity:0.5; }
        .btn-secondary { display:inline-flex; align-items:center; gap:6px; border-radius:10px; border:1px solid var(--line); background:var(--surface); color:var(--text-muted); font-size:13px; padding:8px 14px; }
        .btn-secondary:hover { border-color:var(--accent); color:var(--text); }
      `}</style>
    </div>
  );
}
