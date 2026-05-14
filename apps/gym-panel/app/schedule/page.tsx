'use client';

import Shell from '../../components/Shell';
import { api } from '../../lib/api';
import { useEffect, useState } from 'react';
import { Clock, Save, CheckCircle, AlertCircle } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

type DaySchedule = {
  dayOfWeek: number;
  label: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  breakStartTime?: string | null;
  breakEndTime?: string | null;
};

const defaultDay = (i: number): DaySchedule => ({
  dayOfWeek: i,
  label: DAYS[i],
  isOpen: i < 6,
  openTime: '06:00',
  closeTime: '22:00',
  breakStartTime: null,
  breakEndTime: null,
});

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!on)}
      className="relative cursor-pointer select-none"
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: on ? 'var(--accent)' : 'rgba(255,255,255,0.12)',
        transition: 'background 0.2s',
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: on ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: on ? '#060606' : 'rgba(255,255,255,0.5)',
        transition: 'left 0.2s',
      }} />
    </div>
  );
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 8, color: '#fff', padding: '8px 10px',
        fontFamily: 'DM Sans, sans-serif', fontSize: 14,
        colorScheme: 'dark',
        width: 112,
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    />
  );
}

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<DaySchedule[]>(DAYS.map((_, i) => defaultDay(i)));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/sessions/schedule').then((data: DaySchedule[]) => {
      if (Array.isArray(data)) setSchedule(data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const update = (i: number, patch: Partial<DaySchedule>) => {
    setSchedule((prev) => prev.map((d, idx) => idx === i ? { ...d, ...patch } : d));
  };

  const save = async () => {
    setSaving(true); setError('');
    try {
      await api.put('/sessions/schedule', { days: schedule });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e?.message || 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  // Quick presets
  const applyPreset = (preset: 'weekdays' | 'all' | 'custom') => {
    setSchedule((prev) => prev.map((d) => ({
      ...d,
      isOpen: preset === 'all' ? true : preset === 'weekdays' ? d.dayOfWeek < 5 : d.isOpen,
    })));
  };

  return (
    <Shell title="Operating Hours">
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        {/* Header */}
        <div className="glass" style={{ borderRadius: 20, padding: 28, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(61,255,84,0.12)', border: '1px solid rgba(61,255,84,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={20} color="var(--accent)" />
            </div>
            <div>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: '#fff', margin: 0 }}>Operating Hours</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>Set your gym's weekly opening & closing times</p>
            </div>
          </div>

          {/* Presets */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            {[
              { label: 'Mon–Fri only', action: () => applyPreset('weekdays') },
              { label: 'Open all 7 days', action: () => applyPreset('all') },
            ].map((p) => (
              <button key={p.label} onClick={p.action} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.6)', cursor: 'pointer', letterSpacing: 0.3,
              }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Schedule rows */}
        {loading ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: 40 }}>Loading schedule…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {schedule.map((day, i) => (
              <div key={day.dayOfWeek} className="glass" style={{
                borderRadius: 16, padding: '16px 20px',
                opacity: day.isOpen ? 1 : 0.55,
                borderColor: day.isOpen ? 'rgba(61,255,84,0.18)' : 'rgba(255,255,255,0.06)',
                transition: 'opacity 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: day.isOpen ? 'flex-start' : 'center', gap: 16, flexWrap: 'wrap' }}>
                  {/* Day name + toggle */}
                  <div style={{ width: 120, display: 'flex', alignItems: 'center', gap: 10, paddingTop: day.isOpen ? 24 : 0 }}>
                    <Toggle on={day.isOpen} onChange={(v) => update(i, { isOpen: v })} />
                    <span style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, color: day.isOpen ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                      {day.label}
                    </span>
                  </div>

                  {/* Time pickers */}
                  {day.isOpen ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 620px', flexWrap: 'wrap', minWidth: 0 }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', minWidth: 40 }}>Opens</span>
                      <TimeInput value={day.openTime} onChange={(v) => update(i, { openTime: v })} />
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>→</span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', minWidth: 44 }}>Closes</span>
                      <TimeInput value={day.closeTime} onChange={(v) => update(i, { closeTime: v })} />
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Break</span>
                      <TimeInput value={day.breakStartTime || ''} onChange={(v) => update(i, { breakStartTime: v || null })} />
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>to</span>
                      <TimeInput value={day.breakEndTime || ''} onChange={(v) => update(i, { breakEndTime: v || null })} />

                      {/* Hours indicator */}
                      <span style={{ fontSize: 12, color: 'var(--accent)', marginLeft: 8, fontWeight: 600 }}>
                        {(() => {
                          const [oh, om] = day.openTime.split(':').map(Number);
                          const [ch, cm] = day.closeTime.split(':').map(Number);
                          let mins = (ch * 60 + cm) - (oh * 60 + om);
                          if (day.breakStartTime && day.breakEndTime) {
                            const [bh, bm] = day.breakStartTime.split(':').map(Number);
                            const [eh, em] = day.breakEndTime.split(':').map(Number);
                            mins -= (eh * 60 + em) - (bh * 60 + bm);
                          }
                          return mins > 0 ? `${Math.round((mins / 60) * 10) / 10}h bookable` : '';
                        })()}
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Closed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Save bar */}
        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={save}
            disabled={saving}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 30 }}
          >
            {saving ? (
              <span style={{ width: 18, height: 18, border: '2px solid #06060680', borderTop: '2px solid #060606', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
            ) : (
              <Save size={16} />
            )}
            Save Schedule
          </button>

          {saved && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)', fontSize: 14 }}>
              <CheckCircle size={16} /> Saved successfully
            </div>
          )}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#FF6B6B', fontSize: 14 }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}
        </div>

        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 12 }}>
          Gym Workout slots are auto-generated within opening hours and skip the configured break time.
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Shell>
  );
}
