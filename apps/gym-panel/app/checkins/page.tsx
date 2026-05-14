'use client';
import { useCallback, useEffect, useState } from 'react';
import Shell from '../../components/Shell';
import { Activity, CheckCircle, Clock, IndianRupee, TrendingUp } from 'lucide-react';
import { api } from '../../lib/api';
import Pagination from '../../components/Pagination';

interface CheckIn {
  id: string;
  userId: string;
  userName?: string;
  userPhone?: string;
  checkinTime: string;
  status: string;
  planType?: string;
  gymEarns: number;
  adminEarns: number;
}

interface GymMeta { name: string; ratePerDay: number; commissionRate: number }

function SkeletonRow() {
  return (
    <tr style={{ opacity: 0.4 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i}><div style={{ height: 14, borderRadius: 6, background: 'rgba(255,255,255,0.08)', animation: 'pulse 1.5s ease-in-out infinite' }} /></td>
      ))}
    </tr>
  );
}

export default function GymCheckinsPage() {
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [gymMeta, setGymMeta] = useState<GymMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>(`/gyms/my-checkins?page=${page}&limit=${limit}`);
      const raw = Array.isArray(res) ? res : (res?.data ?? []);
      setCheckins(raw.map((c: any) => ({
        id: c.id,
        userId: c.userId ? `MBR-${String(c.userId).slice(0, 6).toUpperCase()}` : '—',
        userName: c.userName,
        userPhone: c.userPhone,
        checkinTime: c.checkinTime || c.createdAt || '',
        status: c.status || 'success',
        planType: c.planType,
        gymEarns: Number(c.gymEarns ?? 0),
        adminEarns: Number(c.adminEarns ?? 0),
      })));
      setTotal(res?.total ?? raw.length);
      setPages(res?.pages ?? 1);
      if (res?.gym) setGymMeta(res.gym);
    } catch {
      setCheckins([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => { load(); }, [load]);

  const successCount = checkins.filter(c => c.status === 'success').length;
  const totalGymEarnings = checkins.reduce((s, c) => s + c.gymEarns, 0);
  const totalAdminEarnings = checkins.reduce((s, c) => s + c.adminEarns, 0);

  return (
    <Shell title="Attendance & Check-ins">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Records', value: total, icon: Activity, color: 'var(--accent)' },
          { label: 'Successful', value: successCount, icon: CheckCircle, color: '#22c55e' },
          { label: 'Gym Earns (page)', value: `₹${totalGymEarnings.toFixed(0)}`, icon: IndianRupee, color: 'var(--accent)' },
          { label: 'Platform Fee (page)', value: `₹${totalAdminEarnings.toFixed(0)}`, icon: TrendingUp, color: 'var(--t2)' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card stat-glow p-5">
              <div className="flex items-center gap-3 mb-2">
                <Icon size={15} style={{ color: s.color }} />
                <span style={{ fontSize: 11, color: 'var(--t2)' }}>{s.label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{loading ? '—' : s.value}</div>
            </div>
          );
        })}
      </div>

      {/* Rate info banner */}
      {gymMeta && (
        <div className="glass card p-3 mb-5 flex items-center gap-6" style={{ fontSize: 13 }}>
          <span style={{ color: 'var(--t2)' }}>Rate per visit-day: <strong style={{ color: 'var(--t)' }}>₹{gymMeta.ratePerDay}</strong></span>
          <span style={{ color: 'var(--t2)' }}>Commission: <strong style={{ color: 'var(--t)' }}>{gymMeta.commissionRate}%</strong></span>
          <span style={{ color: 'var(--t2)' }}>Your cut per visit: <strong style={{ color: 'var(--accent)' }}>₹{(gymMeta.ratePerDay * (1 - gymMeta.commissionRate / 100)).toFixed(0)}</strong></span>
          <span style={{ color: 'var(--t3)', fontSize: 11, marginLeft: 'auto' }}>Settled end of month</span>
        </div>
      )}

      <div className="glass overflow-hidden">
        <table className="glass-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Date & Time</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Gym Earns</th>
              <th>Platform Fee</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              : checkins.length === 0
                ? <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--t2)', padding: '40px 0' }}>No check-ins recorded yet</td></tr>
                : checkins.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: 13 }}>{c.userName || c.userId}</div>
                      {c.userPhone && <div style={{ color: 'var(--t2)', fontSize: 11, fontFamily: 'monospace' }}>{c.userPhone}</div>}
                    </td>
                    <td style={{ color: 'var(--t2)', fontSize: 12 }}>
                      {c.checkinTime ? new Date(c.checkinTime).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td>
                      {c.planType
                        ? <span style={{ background: 'rgba(204,255,0,0.1)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>{c.planType}</span>
                        : <span style={{ color: 'var(--t3)', fontSize: 11 }}>—</span>}
                    </td>
                    <td>
                      <span className={c.status === 'success' ? 'badge-active' : 'badge-danger'} style={{ textTransform: 'capitalize' }}>{c.status}</span>
                    </td>
                    <td style={{ fontWeight: 700, color: c.gymEarns > 0 ? 'var(--accent)' : 'var(--t3)' }}>
                      {c.gymEarns > 0 ? `₹${c.gymEarns.toFixed(0)}` : '—'}
                    </td>
                    <td style={{ color: 'var(--t2)', fontSize: 12 }}>
                      {c.adminEarns > 0 ? `₹${c.adminEarns.toFixed(0)}` : '—'}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={pages} total={total} limit={limit} onPage={setPage} onLimit={l => { setLimit(l); setPage(1); }} />
    </Shell>
  );
}
