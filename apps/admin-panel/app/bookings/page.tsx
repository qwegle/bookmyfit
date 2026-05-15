'use client';

import { useCallback, useEffect, useState } from 'react';
import Shell from '../../components/Shell';
import { api } from '../../lib/api';
import { BookOpen, CheckCircle, Clock, Download, RefreshCw, XCircle } from 'lucide-react';
import Pagination from '../../components/Pagination';

type Booking = {
  id: string;
  manualCode?: string;
  bookingRef?: string;
  slotDate: string;
  status: 'confirmed' | 'attended' | 'not_attended' | 'cancelled' | string;
  bookedAt: string;
  amountPaid?: number;
  planName?: string;
  planType?: string;
  user?: { name?: string; phone?: string; email?: string };
  gym?: { name?: string; city?: string; area?: string };
  subscription?: { planName?: string; planType?: string; amountPaid?: number; status?: string };
  sessionType?: { name?: string };
  slot?: { startTime?: string; endTime?: string; date?: string };
};

const STATUSES = ['all', 'confirmed', 'attended', 'not_attended', 'cancelled'] as const;

function statusStyle(status: string): React.CSSProperties {
  if (status === 'attended') return { background: 'rgba(34,197,94,0.14)', color: '#22c55e' };
  if (status === 'confirmed') return { background: 'rgba(255,180,0,0.14)', color: '#FFB400' };
  if (status === 'cancelled' || status === 'not_attended') return { background: 'rgba(239,68,68,0.14)', color: '#ef4444' };
  return { background: 'rgba(255,255,255,0.08)', color: 'var(--t2)' };
}

function fmtDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const statusQuery = status !== 'all' ? `&status=${status}` : '';
      const res: any = await api.get(`/sessions/admin/bookings?page=${page}&limit=${limit}${statusQuery}`);
      const rows = Array.isArray(res) ? res : res?.data ?? [];
      setBookings(rows);
      setTotal(res?.total ?? rows.length);
      setPages(res?.pages ?? 1);
    } catch {
      setBookings([]);
      setTotal(0);
      setPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, limit, status]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [status]);

  const exportCSV = () => {
    const rows = [['Manual ID','User','Gym','Plan','Session','Date','Time','Status','Amount']];
    bookings.forEach((b) => rows.push([
      b.manualCode || b.bookingRef || b.id,
      b.user?.name || b.user?.phone || '',
      b.gym?.name || '',
      b.subscription?.planName || b.planName || b.planType || '',
      b.sessionType?.name || '',
      b.slotDate || '',
      b.slot ? `${b.slot.startTime || ''}-${b.slot.endTime || ''}` : '',
      b.status,
      String(b.subscription?.amountPaid ?? b.amountPaid ?? 0),
    ]));
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'gym-bookings.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const counts = {
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    attended: bookings.filter((b) => b.status === 'attended').length,
    missed: bookings.filter((b) => b.status === 'not_attended').length,
  };

  return (
    <Shell title="Gym Booking Tracker">
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Bookings', value: loading ? '-' : String(total), icon: BookOpen },
          { label: 'Confirmed', value: loading ? '-' : String(counts.confirmed), icon: Clock },
          { label: 'Checked In', value: loading ? '-' : String(counts.attended), icon: CheckCircle },
          { label: 'Missed', value: loading ? '-' : String(counts.missed), icon: XCircle },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="card stat-glow p-5">
              <div className="flex items-center gap-3 mb-2">
                <Icon size={16} style={{ color: 'var(--accent)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--t2)' }}>{item.label}</span>
              </div>
              <div className="text-2xl font-bold">{item.value}</div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button onClick={load} className="btn btn-ghost flex items-center gap-2"><RefreshCw size={14} /> Refresh</button>
        <button onClick={exportCSV} className="btn btn-ghost flex items-center gap-2"><Download size={14} /> Export CSV</button>
        <div className="flex gap-2 flex-wrap">
          {STATUSES.map((item) => (
            <button
              key={item}
              onClick={() => setStatus(item)}
              className="btn text-xs"
              style={{
                background: status === item ? 'var(--accent)' : 'var(--glass-bg)',
                color: status === item ? '#000' : 'var(--t)',
                border: `1px solid ${status === item ? 'transparent' : 'var(--border-strong)'}`,
                padding: '6px 14px',
                textTransform: 'capitalize',
              }}
            >
              {item.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="glass overflow-hidden">
        <table className="glass-table">
          <thead>
            <tr>
              <th>Manual ID</th>
              <th>User</th>
              <th>Gym</th>
              <th>Plan</th>
              <th>Session</th>
              <th>Date / Time</th>
              <th>Status</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--t2)', padding: 40 }}>Loading bookings...</td></tr>
            ) : bookings.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--t2)', padding: 40 }}>No gym bookings found</td></tr>
            ) : bookings.map((b) => (
              <tr key={b.id}>
                <td style={{ color: 'var(--accent)', fontFamily: 'monospace', fontWeight: 800 }}>#{b.manualCode || b.bookingRef || b.id}</td>
                <td>
                  <div style={{ fontWeight: 700, color: '#fff', fontSize: 13 }}>{b.user?.name || b.user?.phone || 'Member'}</div>
                  <div style={{ color: 'var(--t2)', fontSize: 11 }}>{b.user?.phone || b.user?.email || '-'}</div>
                </td>
                <td style={{ color: 'var(--t)' }}>{b.gym?.name || '-'}</td>
                <td>
                  <div style={{ color: 'var(--t)' }}>{b.subscription?.planName || b.planName || b.planType || '-'}</div>
                  <div style={{ color: 'var(--t3)', fontSize: 11 }}>{b.subscription?.status || ''}</div>
                </td>
                <td style={{ color: 'var(--t2)' }}>{b.sessionType?.name || 'Gym Workout'}</td>
                <td>
                  <div style={{ color: 'var(--t)' }}>{fmtDate(b.slotDate)}</div>
                  <div style={{ color: 'var(--t3)', fontSize: 11 }}>{b.slot ? `${b.slot.startTime || ''} - ${b.slot.endTime || ''}` : '-'}</div>
                </td>
                <td>
                  <span style={{ ...statusStyle(b.status), padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                    {b.status.replace('_', ' ')}
                  </span>
                </td>
                <td style={{ color: '#fff', fontWeight: 800 }}>Rs {Number(b.subscription?.amountPaid ?? b.amountPaid ?? 0).toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={pages} total={total} limit={limit} onPage={setPage} onLimit={(next) => { setLimit(next); setPage(1); }} />
    </Shell>
  );
}
