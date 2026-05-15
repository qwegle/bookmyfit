'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Shell from '../../components/Shell';
import { QrCode, CheckCircle2, XCircle, Camera, CameraOff, Keyboard, Users, Clock, IndianRupee, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';

/** Decode a JWT payload without verifying signature — used to extract member userId from scanned QR token */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

type ScanResult = {
  ok: boolean;
  userName?: string;
  planType?: string;
  bookingRef?: string;
  message?: string;
  gymEarns?: number;
  adminEarns?: number;
};

type AttendanceRecord = ScanResult & { time: string; id: string };

export default function ScannerPage() {
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [qrToken, setQrToken] = useState('');
  const [gymId, setGymId] = useState<string | null>(null);
  const [ratePerDay, setRatePerDay] = useState(50);
  const [commissionRate, setCommissionRate] = useState(15);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    api.get<any>('/gyms/my-gym').then(data => {
      if (data?.id) setGymId(data.id);
      if (data?.ratePerDay) setRatePerDay(Number(data.ratePerDay));
      if (data?.commissionRate) setCommissionRate(Number(data.commissionRate));
    }).catch(() => {});
  }, []);

  const startScanLoop = useCallback(() => {
    if (scanLoopRef.current) clearInterval(scanLoopRef.current);
    scanLoopRef.current = setInterval(() => {
      if (pausedRef.current) return;
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        detector.detect(canvas).then((codes: any[]) => {
          if (codes.length > 0 && !pausedRef.current) {
            pausedRef.current = true;
            validateToken(codes[0].rawValue as string);
          }
        }).catch(() => {});
      }
    }, 400);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    pausedRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);
        startScanLoop();
      }
    } catch {
      setCameraError('Camera access denied. Use manual input below.');
      setMode('manual');
    }
  }, [startScanLoop]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (scanLoopRef.current) { clearInterval(scanLoopRef.current); scanLoopRef.current = null; }
    setScanning(false);
  }, []);

  useEffect(() => {
    if (mode === 'camera') startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [mode, startCamera, stopCamera]);

  /** Show result for 5s, record attendance, then auto-resume */
  const showResultAndResume = useCallback((res: ScanResult) => {
    setResult(res);
    setAttendance(prev => [{
      ...res,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      id: String(Date.now()),
    }, ...prev.slice(0, 49)]);

    let secs = 5;
    setCountdown(secs);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      secs -= 1;
      setCountdown(secs);
      if (secs <= 0) {
        clearInterval(countdownRef.current!);
        setResult(null);
        setCountdown(0);
        pausedRef.current = false; // resume camera scan
      }
    }, 1000);
  }, []);

  const validateToken = useCallback(async (token?: string) => {
    const t = (token ?? qrToken).trim();
    if (!t) return;

    // Decode the QR JWT to extract the member's userId
    const payload = decodeJwtPayload(t);
    const memberId: string | undefined = payload?.sub;

    if (!gymId) {
      showResultAndResume({ ok: false, message: 'Gym profile is not loaded yet. Refresh and try again.' });
      return;
    }

    if (!memberId) {
      setValidating(true);
      try {
        const scanRes = await api.post<any>('/qr/validate-manual', { code: t, gymId });
        const gymEarns = scanRes?.gymEarns != null
          ? Number(scanRes.gymEarns)
          : ratePerDay * (1 - commissionRate / 100);
        const adminEarns = scanRes?.adminEarns != null
          ? Number(scanRes.adminEarns)
          : ratePerDay - gymEarns;
        showResultAndResume({
          ok: true,
          userName: scanRes?.user?.name || (scanRes?.user?.id ? `Member ${String(scanRes.user.id).slice(0, 8)}` : 'Member'),
          planType: scanRes?.planType || 'Manual Check-in',
          bookingRef: scanRes?.bookingRef || undefined,
          message: scanRes?.message || 'Manual check-in recorded!',
          gymEarns,
          adminEarns,
        });
      } catch (e: any) {
        let msg = e?.message || 'Manual check-in failed';
        try { msg = JSON.parse(msg)?.message || msg; } catch { /* */ }
        showResultAndResume({ ok: false, message: msg });
      } finally {
        setValidating(false);
        setQrToken('');
      }
      return;
    }

    if (!memberId) {
      showResultAndResume({ ok: false, message: 'Invalid QR — could not read member ID. Ask member to regenerate.' });
      return;
    }

    if (!gymId) {
      showResultAndResume({ ok: false, message: 'Gym profile is not loaded yet. Refresh and try again.' });
      return;
    }

    setValidating(true);
    try {
      const scanRes = await api.post<any>('/qr/validate', { qrToken: t, gymId });
      if (scanRes?.success === false) {
        showResultAndResume({ ok: false, message: scanRes.message || 'Check-in denied' });
      } else {
        const gymEarns = scanRes?.gymEarns != null
          ? Number(scanRes.gymEarns)
          : ratePerDay * (1 - commissionRate / 100);
        const adminEarns = scanRes?.adminEarns != null
          ? Number(scanRes.adminEarns)
          : ratePerDay - gymEarns;
        showResultAndResume({
          ok: true,
          userName: scanRes?.user?.name || (scanRes?.user?.id ? `Member ${String(scanRes.user.id).slice(0, 8)}` : 'Member'),
          planType: scanRes?.planType || 'QR Check-in',
          bookingRef: scanRes?.bookingRef || undefined,
          message: scanRes?.message || 'Check-in recorded!',
          gymEarns,
          adminEarns,
        });
      }
    } catch (e: any) {
      let msg = e?.message || 'Scan failed';
      try { msg = JSON.parse(msg)?.message || msg; } catch { /* */ }
      showResultAndResume({ ok: false, message: msg });
    } finally {
      setValidating(false);
      setQrToken('');
    }
  }, [gymId, qrToken, ratePerDay, commissionRate, showResultAndResume]);

  const todaySuccess = attendance.filter(a => a.ok).length;
  const todayGymEarnings = attendance.filter(a => a.ok && a.gymEarns).reduce((s, a) => s + (a.gymEarns ?? 0), 0);
  const todayAdminEarnings = attendance.filter(a => a.ok && a.adminEarns).reduce((s, a) => s + (a.adminEarns ?? 0), 0);

  return (
    <Shell title="Check-in Scanner">
      <style>{`
        @keyframes scanPulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes resultPop{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}
      `}</style>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>

        {/* LEFT — scanner */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Mode tabs */}
          <div className="flex gap-2">
            {([['camera', 'Camera', Camera], ['manual', 'Manual', Keyboard]] as const).map(([key, label, Icon]) => (
              <button key={key} onClick={() => setMode(key as 'camera' | 'manual')} className="btn flex-1 justify-center"
                style={{ background: mode === key ? 'var(--accent)' : 'var(--glass-bg)', color: mode === key ? '#000' : 'var(--t)', border: `1px solid ${mode === key ? 'transparent' : 'var(--border-strong)'}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {/* Camera */}
          {mode === 'camera' && (
            <div className="glass overflow-hidden" style={{ borderRadius: 18 }}>
              <div style={{ position: 'relative', background: '#000', minHeight: 300 }}>
                <video ref={videoRef} playsInline muted
                  style={{ width: '100%', display: scanning ? 'block' : 'none', maxHeight: 380, objectFit: 'cover' }} />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {!scanning && !cameraError && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
                    <Camera size={40} style={{ color: 'var(--t3)' }} />
                    <span style={{ color: 'var(--t2)', fontSize: 13 }}>Starting camera…</span>
                  </div>
                )}
                {cameraError && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 20 }}>
                    <CameraOff size={36} style={{ color: '#FF3C3C' }} />
                    <span style={{ color: '#FF3C3C', fontSize: 13, textAlign: 'center' }}>{cameraError}</span>
                  </div>
                )}

                {/* Scan frame */}
                {scanning && !result && (
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 160, height: 160, position: 'relative' }}>
                      {[
                        { top: 0, left: 0, borderRight: 'none', borderBottom: 'none' },
                        { top: 0, right: 0, borderLeft: 'none', borderBottom: 'none' },
                        { bottom: 0, left: 0, borderRight: 'none', borderTop: 'none' },
                        { bottom: 0, right: 0, borderLeft: 'none', borderTop: 'none' },
                      ].map((s, i) => (
                        <div key={i} style={{ position: 'absolute', ...s, width: 24, height: 24, border: '3px solid var(--accent)', borderRadius: 3 }} />
                      ))}
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                        <QrCode size={32} style={{ color: 'rgba(204,255,0,0.4)', animation: 'scanPulse 1.5s ease-in-out infinite' }} />
                        <span style={{ color: 'var(--accent)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', animation: 'scanPulse 1.5s ease-in-out infinite' }}>Scanning</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Result overlay on camera */}
                {result && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: result.ok ? 'rgba(61,255,84,0.15)' : 'rgba(255,60,60,0.15)', backdropFilter: 'blur(4px)' }}>
                    <div style={{ textAlign: 'center', animation: 'resultPop 0.25s ease-out' }}>
                      {result.ok
                        ? <CheckCircle2 size={72} style={{ color: 'var(--accent)', marginBottom: 12 }} />
                        : <XCircle size={72} style={{ color: '#FF3C3C', marginBottom: 12 }} />}
                      <div style={{ fontSize: 18, fontWeight: 700, color: result.ok ? 'var(--accent)' : '#FF3C3C', marginBottom: 6 }}>
                        {result.ok ? '✓ Check-in Recorded' : '✗ Denied'}
                      </div>
                      {result.message && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 8 }}>{result.message}</div>}
                      {result.gymEarns != null && (
                        <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>
                          Gym earns ₹{result.gymEarns.toFixed(0)} for this visit
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 }}>
                        <RefreshCw size={13} style={{ color: 'rgba(255,255,255,0.5)' }} />
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Next scan in {countdown}s…</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--t2)' }}>
                  {result ? `Resuming in ${countdown}s…` : scanning ? 'Point at QR code — scanning continuously' : 'Camera off'}
                </span>
                <button onClick={scanning ? stopCamera : startCamera} className="btn btn-ghost text-xs">
                  {scanning ? 'Stop' : 'Start Camera'}
                </button>
              </div>
            </div>
          )}

          {/* Manual input */}
          <div className="glass p-5">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <QrCode size={16} style={{ color: 'var(--accent)' }} />
              <span style={{ fontWeight: 700, fontSize: 13 }}>{mode === 'camera' ? 'Or enter token manually' : 'Enter QR Token'}</span>
            </div>
            <textarea value={qrToken} onChange={e => setQrToken(e.target.value)}
              placeholder="Paste QR token, booking ref, or booking ID here..." className="glass-input w-full mb-3"
              style={{ minHeight: 72, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }} />
            <button onClick={() => validateToken()} disabled={validating || !qrToken.trim()} className="btn btn-primary w-full justify-center"
              style={{ opacity: validating || !qrToken.trim() ? 0.5 : 1 }}>
              {validating ? 'Validating…' : 'Validate & Check In'}
            </button>
          </div>

          {/* Result card (manual mode only) */}
          {result && mode === 'manual' && (
            <div className="glass p-5" style={{ border: `2px solid ${result.ok ? 'var(--accent)' : '#FF3C3C'}`, animation: 'resultPop 0.25s ease-out' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                {result.ok ? <CheckCircle2 size={26} style={{ color: 'var(--accent)' }} /> : <XCircle size={26} style={{ color: '#FF3C3C' }} />}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: result.ok ? 'var(--accent)' : '#FF3C3C' }}>
                    {result.ok ? 'Check-in Recorded' : 'Denied'}
                  </div>
                  {result.message && <div style={{ fontSize: 12, color: 'var(--t2)' }}>{result.message}</div>}
                </div>
              </div>
              {result.ok && result.gymEarns != null && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="card p-3" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>Gym Earns</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>₹{result.gymEarns.toFixed(0)}</div>
                  </div>
                  <div className="card p-3" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>Platform Fee</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--t2)' }}>₹{result.adminEarns?.toFixed(0)}</div>
                  </div>
                </div>
              )}
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--t3)', fontSize: 12 }}>
                <RefreshCw size={12} /> Auto-clearing in {countdown}s…
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — today's live attendance log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'Checked In', value: String(todaySuccess), icon: <Users size={13} />, color: 'var(--accent)' },
              { label: 'Gym Earns', value: `₹${todayGymEarnings.toFixed(0)}`, icon: <IndianRupee size={13} />, color: 'var(--accent)' },
              { label: 'Platform', value: `₹${todayAdminEarnings.toFixed(0)}`, icon: <IndianRupee size={13} />, color: 'var(--t2)' },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--t3)', fontSize: 10, marginBottom: 5 }}>{s.icon}{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Rate config */}
          <div className="glass card p-3">
            <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Rate Config</div>
            {[
              { label: 'Rate / visit-day', value: `₹${ratePerDay}` },
              { label: 'Commission', value: `${commissionRate}%` },
              { label: 'Gym gets / visit', value: `₹${(ratePerDay * (1 - commissionRate / 100)).toFixed(0)}`, highlight: true },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: 'var(--t2)' }}>{r.label}</span>
                <strong style={{ color: r.highlight ? 'var(--accent)' : 'var(--t)' }}>{r.value}</strong>
              </div>
            ))}
          </div>

          {/* Live attendance list */}
          <div className="glass" style={{ borderRadius: 14 }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={14} style={{ color: 'var(--accent)' }} />
              <span style={{ fontWeight: 600, fontSize: 13 }}>Live Attendance Log</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t3)' }}>session only</span>
            </div>
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {attendance.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
                  No scans yet — start scanning!
                </div>
              ) : attendance.map(a => (
                <div key={a.id} style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  {a.ok
                    ? <CheckCircle2 size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    : <XCircle size={15} style={{ color: '#FF3C3C', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.userName || 'Member'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                      {a.planType && <span style={{ color: 'var(--accent)', marginRight: 5 }}>{a.planType}</span>}
                      {a.bookingRef && <span style={{ color: 'var(--t2)', marginRight: 5 }}>#{a.bookingRef}</span>}
                      {!a.ok && <span style={{ color: '#FF3C3C' }}>{a.message}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {a.ok && a.gymEarns != null && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>+₹{a.gymEarns.toFixed(0)}</div>
                    )}
                    <div style={{ fontSize: 10, color: 'var(--t3)' }}>{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
