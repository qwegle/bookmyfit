'use client';

import Shell from '../../components/Shell';
import { api } from '../../lib/api';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit3, Check, X, Calendar, Users, Clock, Zap, Star, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const COLORS = ['#3DFF54', '#6C63FF', '#FF6B6B', '#FFD93D', '#FF8C00', '#00D4FF', '#FF69B4'];

type SessionType = {
  id: string; gymId: string; name: string; kind: 'standard' | 'special';
  description?: string; durationMinutes: number; maxCapacity: number;
  color: string; instructor?: string; isActive: boolean; createdAt: string;
};

type SessionSchedule = {
  id: string; sessionTypeId: string; gymId: string;
  daysOfWeek: number[]; startTime: string; endTime: string;
  isActive: boolean; validFrom?: string; validUntil?: string;
  sessionType?: SessionType;
};

type BookingRow = {
  id: string; slotDate: string; status: string; bookingRef: string;
  manualCode?: string;
  planName?: string;
  planType?: string;
  amountPaid?: number;
  subscription?: { planName?: string; planType?: string; amountPaid?: number; status?: string };
  slot?: { startTime: string; endTime: string; date: string };
  sessionType?: { name: string; color: string };
  user?: { name: string; phone: string };
};

const pill = (color: string) => ({
  background: `${color}22`, border: `1px solid ${color}44`,
  borderRadius: 20, padding: '3px 10px', fontSize: 11,
  fontWeight: 700, color, letterSpacing: 0.5,
});

export default function SessionsPage() {
  const [tab, setTab] = useState<'types' | 'bookings'>('types');
  const [sessionTypes, setSessionTypes] = useState<SessionType[]>([]);
  const [schedules, setSchedules] = useState<SessionSchedule[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingType, setEditingType] = useState<SessionType | null>(null);
  const [error, setError] = useState('');

  // New session form state
  const [form, setForm] = useState({
    name: '', description: '', durationMinutes: 60,
    maxCapacity: 20, color: COLORS[1], instructor: '',
  });
  const [scheduleForm, setScheduleForm] = useState({
    daysOfWeek: [] as number[],
    startTime: '07:00', endTime: '08:00',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [types, scheds] = await Promise.all([
        api.get('/sessions/session-types'),
        api.get('/sessions/session-schedules'),
      ]);
      setSessionTypes(types || []);
      setSchedules(scheds || []);
    } catch {}
    setLoading(false);
  };

  const loadBookings = async (date: string) => {
    try {
      const data = await api.get(`/sessions/gym-bookings?date=${date}`);
      setBookings(data || []);
    } catch {}
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === 'bookings') loadBookings(bookingDate); }, [tab, bookingDate]);

  const resetForm = () => {
    setForm({ name: '', description: '', durationMinutes: 60, maxCapacity: 20, color: COLORS[1], instructor: '' });
    setScheduleForm({ daysOfWeek: [], startTime: '07:00', endTime: '08:00' });
    setEditingType(null);
    setShowAddForm(false);
  };

  const saveType = async () => {
    setError('');
    if (!form.name.trim()) { setError('Session name is required'); return; }
    try {
      if (editingType) {
        await api.put(`/sessions/session-types/${editingType.id}`, form);
      } else {
        const created: SessionType = await api.post('/sessions/session-types', form);
        // Also save schedule if days were selected
        if (scheduleForm.daysOfWeek.length > 0) {
          await api.put('/sessions/session-schedules', {
            sessionTypeId: created.id,
            ...scheduleForm,
          });
        }
      }
      await load();
      resetForm();
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    }
  };

  const saveSchedule = async (sessionTypeId: string) => {
    if (scheduleForm.daysOfWeek.length === 0) { setError('Select at least one day'); return; }
    try {
      await api.put('/sessions/session-schedules', { sessionTypeId, ...scheduleForm });
      await load();
      setExpandedType(null);
      setScheduleForm({ daysOfWeek: [], startTime: '07:00', endTime: '08:00' });
    } catch (e: any) {
      setError(e?.message || 'Failed to save schedule');
    }
  };

  const toggleActive = async (type: SessionType) => {
    try {
      await api.put(`/sessions/session-types/${type.id}`, { isActive: !type.isActive });
      await load();
    } catch {}
  };

  const deleteType = async (id: string) => {
    if (!confirm('Delete this session type? This will also remove its schedule.')) return;
    try {
      await api.del(`/sessions/session-types/${id}`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Cannot delete');
    }
  };

  const getScheduleForType = (id: string) =>
    schedules.find((s) => s.sessionTypeId === id);

  const statusColor = (s: string) => ({
    confirmed: '#3DFF54', attended: '#00D4FF',
    not_attended: '#FF6B6B', cancelled: 'rgba(255,255,255,0.3)',
  }[s] || '#888');

  return (
    <Shell title="Sessions">
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {(['types', 'bookings'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: tab === t ? 'rgba(61,255,84,0.15)' : 'transparent',
            color: tab === t ? 'var(--accent)' : 'rgba(255,255,255,0.5)',
            fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14,
            borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
            transition: 'all 0.2s',
          }}>
            {t === 'types' ? 'Session Types & Schedule' : 'Bookings'}
          </button>
        ))}
      </div>

      {/* ── SESSION TYPES TAB ── */}
      {tab === 'types' && (
        <div style={{ maxWidth: 780 }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#FF6B6B', background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)', borderRadius: 10, padding: '10px 16px', marginBottom: 16 }}>
              <AlertCircle size={16} /> {error}
              <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#FF6B6B', cursor: 'pointer' }}><X size={14} /></button>
            </div>
          )}

          {/* Existing session types */}
          {loading ? (
            <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 40 }}>Loading…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {sessionTypes.map((type) => {
                const sched = getScheduleForType(type.id);
                const isExpanded = expandedType === type.id;
                return (
                  <div key={type.id} className="glass" style={{ borderRadius: 16, overflow: 'hidden', borderColor: type.isActive ? `${type.color}33` : 'rgba(255,255,255,0.06)' }}>
                    {/* Type row */}
                    <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                      {/* Color dot */}
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: type.color, flexShrink: 0 }} />

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <span style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 15, color: '#fff' }}>{type.name}</span>
                          <span style={pill(type.kind === 'standard' ? '#3DFF54' : '#6C63FF')}>
                            {type.kind === 'standard' ? 'STANDARD' : 'SPECIAL'}
                          </span>
                          {!type.isActive && <span style={pill('#888')}>INACTIVE</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                          <span><Clock size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />{type.durationMinutes} min</span>
                          <span><Users size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />Max {type.maxCapacity}</span>
                          {type.instructor && <span><Star size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />{type.instructor}</span>}
                          {sched && (
                            <span style={{ color: 'var(--accent)' }}>
                              <Calendar size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                              {sched.daysOfWeek.map((d) => DAYS[d]).join(', ')} · {sched.startTime}–{sched.endTime}
                            </span>
                          )}
                          {type.kind === 'standard' && !sched && (
                            <span style={{ color: 'var(--accent)' }}>Auto-generated every hour</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        {type.kind !== 'standard' && (
                          <button onClick={() => { setExpandedType(isExpanded ? null : type.id); setScheduleForm({ daysOfWeek: sched?.daysOfWeek ?? [], startTime: sched?.startTime ?? '07:00', endTime: sched?.endTime ?? '08:00' }); }}
                            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        )}
                        {type.kind !== 'standard' && (
                          <>
                            <button onClick={() => toggleActive(type)} title={type.isActive ? 'Disable' : 'Enable'}
                              style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: type.isActive ? 'rgba(61,255,84,0.1)' : 'rgba(255,255,255,0.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: type.isActive ? 'var(--accent)' : 'rgba(255,255,255,0.4)' }}>
                              <Zap size={14} />
                            </button>
                            <button onClick={() => deleteType(type.id)} title="Delete"
                              style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,107,107,0.2)', background: 'rgba(255,107,107,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF6B6B' }}>
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Expanded schedule editor */}
                    {isExpanded && type.kind !== 'standard' && (
                      <div style={{ padding: '0 20px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 14, marginTop: 14 }}>Set recurring schedule for <strong style={{ color: '#fff' }}>{type.name}</strong></p>

                        {/* Days of week */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                          {DAYS.map((day, idx) => {
                            const sel = scheduleForm.daysOfWeek.includes(idx);
                            return (
                              <button key={idx} onClick={() => setScheduleForm((p) => ({
                                ...p,
                                daysOfWeek: sel ? p.daysOfWeek.filter((d) => d !== idx) : [...p.daysOfWeek, idx],
                              }))}
                                style={{
                                  width: 44, height: 36, borderRadius: 8, border: `1px solid ${sel ? type.color : 'rgba(255,255,255,0.1)'}`,
                                  background: sel ? `${type.color}22` : 'rgba(255,255,255,0.04)',
                                  color: sel ? type.color : 'rgba(255,255,255,0.5)',
                                  cursor: 'pointer', fontSize: 12, fontWeight: 700,
                                }}>
                                {day}
                              </button>
                            );
                          })}
                        </div>

                        {/* Time range */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                          <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', minWidth: 40 }}>Start</label>
                          <input type="time" value={scheduleForm.startTime} onChange={(e) => setScheduleForm((p) => ({ ...p, startTime: e.target.value }))}
                            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', padding: '6px 12px', colorScheme: 'dark', fontSize: 14 }} />
                          <span style={{ color: 'rgba(255,255,255,0.3)' }}>→</span>
                          <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', minWidth: 30 }}>End</label>
                          <input type="time" value={scheduleForm.endTime} onChange={(e) => setScheduleForm((p) => ({ ...p, endTime: e.target.value }))}
                            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', padding: '6px 12px', colorScheme: 'dark', fontSize: 14 }} />
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                          <button onClick={() => saveSchedule(type.id)} className="btn-primary" style={{ padding: '9px 22px', borderRadius: 20, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Check size={14} /> Save Schedule
                          </button>
                          <button onClick={() => setExpandedType(null)} style={{ padding: '9px 18px', borderRadius: 20, fontSize: 13, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add special session form */}
          {showAddForm ? (
            <div className="glass" style={{ borderRadius: 16, padding: 24, borderColor: 'rgba(108,99,255,0.3)' }}>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: '#fff', marginBottom: 20, marginTop: 0 }}>
                Add Special Session
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                {[
                  { label: 'Session Name', key: 'name', placeholder: 'e.g. Yoga, Zumba, HIIT' },
                  { label: 'Instructor', key: 'instructor', placeholder: 'Instructor name (optional)' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{label}</label>
                    <input value={(form as any)[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} placeholder={placeholder}
                      style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Description</label>
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Brief description of the session"
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 14, resize: 'vertical', minHeight: 70, boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Duration (min)</label>
                  <input type="number" min={15} max={240} value={form.durationMinutes} onChange={(e) => setForm((p) => ({ ...p, durationMinutes: Number(e.target.value) }))}
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Max Capacity</label>
                  <input type="number" min={1} max={200} value={form.maxCapacity} onChange={(e) => setForm((p) => ({ ...p, maxCapacity: Number(e.target.value) }))}
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Color</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {COLORS.map((c) => (
                      <button key={c} onClick={() => setForm((p) => ({ ...p, color: c }))}
                        style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: form.color === c ? '3px solid #fff' : '3px solid transparent', cursor: 'pointer' }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Schedule for new type */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 16, marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>Set recurring schedule (optional — can be added later)</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  {DAYS.map((day, idx) => {
                    const sel = scheduleForm.daysOfWeek.includes(idx);
                    return (
                      <button key={idx} onClick={() => setScheduleForm((p) => ({ ...p, daysOfWeek: sel ? p.daysOfWeek.filter((d) => d !== idx) : [...p.daysOfWeek, idx] }))}
                        style={{ width: 44, height: 36, borderRadius: 8, border: `1px solid ${sel ? form.color : 'rgba(255,255,255,0.1)'}`, background: sel ? `${form.color}22` : 'rgba(255,255,255,0.04)', color: sel ? form.color : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                        {day}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="time" value={scheduleForm.startTime} onChange={(e) => setScheduleForm((p) => ({ ...p, startTime: e.target.value }))}
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', padding: '6px 12px', colorScheme: 'dark', fontSize: 14 }} />
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>→</span>
                  <input type="time" value={scheduleForm.endTime} onChange={(e) => setScheduleForm((p) => ({ ...p, endTime: e.target.value }))}
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', padding: '6px 12px', colorScheme: 'dark', fontSize: 14 }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={saveType} className="btn-primary" style={{ padding: '10px 24px', borderRadius: 20, fontSize: 14 }}>Save Session</button>
                <button onClick={resetForm} style={{ padding: '10px 20px', borderRadius: 20, fontSize: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddForm(true)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '14px 22px',
              background: 'rgba(108,99,255,0.1)', border: '1px dashed rgba(108,99,255,0.4)',
              borderRadius: 16, cursor: 'pointer', color: '#6C63FF',
              fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, width: '100%',
            }}>
              <Plus size={18} /> Add Special Session (Yoga, Zumba, HIIT…)
            </button>
          )}
        </div>
      )}

      {/* ── BOOKINGS TAB ── */}
      {tab === 'bookings' && (
        <div style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Date</label>
            <input type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', padding: '8px 14px', colorScheme: 'dark', fontSize: 14, cursor: 'pointer' }} />
            <button onClick={() => loadBookings(bookingDate)} className="btn-ghost" style={{ padding: '8px 18px', borderRadius: 20, fontSize: 13 }}>Refresh</button>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>{bookings.length} booking{bookings.length !== 1 ? 's' : ''}</span>
          </div>

          {bookings.length === 0 ? (
            <div className="glass" style={{ borderRadius: 16, padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
              No bookings for this date yet.
            </div>
          ) : (
            <div className="glass" style={{ borderRadius: 16, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Manual ID', 'Member', 'Plan', 'Session', 'Time', 'Status', 'Paid'].map((h) => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: 'var(--accent)', letterSpacing: 1 }}>#{b.manualCode || b.bookingRef || b.id}</td>
                      <td style={{ padding: '12px 16px', fontSize: 14, color: '#fff' }}>
                        {b.user?.name ?? '-'}
                        {b.user?.phone && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{b.user.phone}</div>}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
                        {b.subscription?.planName || b.planName || b.planType || '-'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {b.sessionType && <span style={pill(b.sessionType.color)}>{b.sessionType.name}</span>}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                        {b.slot ? `${b.slot.startTime} - ${b.slot.endTime}` : '-'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={pill(statusColor(b.status))}>{b.status.replace('_', ' ').toUpperCase()}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>
                        {Number(b.subscription?.amountPaid ?? b.amountPaid ?? 0) > 0
                          ? `Rs ${Number(b.subscription?.amountPaid ?? b.amountPaid).toLocaleString('en-IN')}`
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}
