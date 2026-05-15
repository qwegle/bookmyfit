'use client';
import { useCallback, useEffect, useState } from 'react';
import Shell from '../../components/Shell';
import { Users, UserCheck, Clock, UserX, Download, Plus, Edit2, Trash2, RefreshCw, AlertTriangle, Search } from 'lucide-react';
import { api } from '../../lib/api';
import Pagination from '../../components/Pagination';

type Member = {
  id: string;
  userId: string;
  name: string;
  phone: string;
  planType: string;
  planName?: string | null;
  gymType: 'Single Gym' | 'Multi Gym';
  gymCount: number;
  status: string;
  subscriptionStatus: string;
  startDate: string;
  endDate: string;
  amountPaid: number;
  gymAmount?: number;
  subscriptionGymAmount?: number;
  trainerGymAmount?: number;
  trainerSummary?: string | null;
  trainerAddons?: Array<{ trainerName: string; status: string; gymAmount: number; monthlyPrice: number }>;
  createdAt: string;
  todayCheckins?: number;
  canDeactivate?: boolean;
};

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'pending', label: 'Pending' },
  { key: 'expired', label: 'Expired' },
  { key: 'cancelled', label: 'Deactivated' },
] as const;

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, React.CSSProperties> = {
    same_gym: { background: 'rgba(100,160,255,0.15)', color: '#64A0FF' },
    day_pass: { background: 'rgba(255,180,0,0.15)', color: '#FFB400' },
    multi_gym: { background: 'rgba(204,255,0,0.12)', color: 'var(--accent)' },
    elite: { background: 'rgba(180,120,255,0.18)', color: '#B478FF' },
    pro: { background: 'rgba(255,180,0,0.15)', color: '#FFB400' },
    max: { background: 'rgba(255,100,60,0.15)', color: '#FF6432' },
    individual: { background: 'rgba(100,160,255,0.15)', color: '#64A0FF' },
    corporate: { background: 'rgba(204,255,0,0.12)', color: 'var(--accent)' },
  };
  const key = plan?.toLowerCase();
  const labels: Record<string, string> = { same_gym: 'Same Gym', day_pass: 'Day Pass', multi_gym: 'Multi Gym' };
  const s = colors[key] || { background: 'rgba(255,255,255,0.08)', color: 'var(--t2)' };
  return <span style={{ ...s, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{labels[key] || plan}</span>;
}

function GymTypeBadge({ type, count }: { type: string; count: number }) {
  const isMulti = type?.toLowerCase().includes('multi') || count > 1;
  const label = isMulti ? 'Multi Gym' : 'Single Gym';
  return (
    <span style={{
      background: isMulti ? 'rgba(204,255,0,0.12)' : 'rgba(255,255,255,0.06)',
      color: isMulti ? 'var(--accent)' : 'var(--t2)',
      padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    }}>
      {isMulti ? `🏋️ ${count} Gyms` : '🏠 Single'}
    </span>
  );
}

function AccessBadge({ type, count }: { type: string; count: number }) {
  const isMulti = type?.toLowerCase().includes('multi') || count > 1;
  return (
    <span style={{
      background: isMulti ? 'rgba(204,255,0,0.12)' : 'rgba(255,255,255,0.06)',
      color: isMulti ? 'var(--accent)' : 'var(--t2)',
      padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    }}>
      {isMulti ? 'Multi Gym' : 'Single Gym'}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, React.CSSProperties> = {
    active: { background: 'rgba(34,197,94,0.15)', color: '#22c55e' },
    expired: { background: 'rgba(255,180,0,0.15)', color: '#FFB400' },
    cancelled: { background: 'rgba(239,68,68,0.15)', color: '#ef4444' },
    pending: { background: 'rgba(100,160,255,0.15)', color: '#64A0FF' },
  };
  const s = map[status] || map['pending'];
  return <span style={{ ...s, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>{status}</span>;
}

function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass p-6 rounded-2xl" style={{ maxWidth: 360, width: '90%' }}>
        <p className="mb-5 text-sm" style={{ color: 'var(--t)' }}>{message}</p>
        <div className="flex gap-3 justify-end">
          <button className="btn btn-ghost text-sm" onClick={onCancel}>Cancel</button>
          <button className="btn text-sm" style={{ background: '#ef4444', color: '#fff' }} onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr style={{ opacity: 0.4 }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i}><div style={{ height: 14, borderRadius: 6, background: 'rgba(255,255,255,0.08)' }} /></td>
      ))}
    </tr>
  );
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [serverStats, setServerStats] = useState<{ total: number; active: number; pending?: number; expired: number; cancelled: number } | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 400);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => { setPage(1); }, [debouncedQ, statusFilter]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get<any>(
        `/gyms/my-members?page=${page}&limit=${limit}${debouncedQ ? `&search=${encodeURIComponent(debouncedQ)}` : ''}${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}`
      );
      const rows: Member[] = Array.isArray(res) ? res : res?.data ?? [];
      setMembers(rows);
      setTotal(res?.total ?? rows.length);
      setPages(res?.pages ?? 1);
      setServerStats(res?.stats ? {
        total: Number(res.stats.total ?? res.total ?? rows.length),
        active: Number(res.stats.active ?? 0),
        pending: Number(res.stats.pending ?? 0),
        expired: Number(res.stats.expired ?? 0),
        cancelled: Number(res.stats.cancelled ?? 0),
      } : null);
    } catch {
      setError('Failed to load members. Please try again.');
      setMembers([]); setTotal(0); setPages(1);
      setServerStats(null);
    } finally { setLoading(false); }
  }, [page, limit, debouncedQ, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const handleDeactivate = async (id: string) => {
    setActionLoading(id);
    try {
      await api.patch(`/gyms/my-members/${id}/deactivate`, {});
      showToast('Member subscription deactivated');
      load();
    } catch {
      showToast('Failed to deactivate member');
    } finally {
      setActionLoading(null);
      setConfirm(null);
    }
  };

  const exportCSV = () => {
    const csv = [
      'Name,Phone,Plan,Gym Type,Status,Start Date,End Date,Trainer,Gym Amount',
      ...members.map(m => [
        m.name, m.phone, m.planType, m.gymType, m.status,
        m.startDate ? new Date(m.startDate).toLocaleDateString('en-IN') : '',
        m.endDate ? new Date(m.endDate).toLocaleDateString('en-IN') : '',
        m.trainerSummary || '',
        m.gymAmount ?? m.amountPaid,
      ].join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'members.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const stats = serverStats || {
    total,
    active: members.filter(m => m.status === 'active').length,
    pending: members.filter(m => m.status === 'pending').length,
    expired: members.filter(m => m.status === 'expired').length,
    cancelled: members.filter(m => m.status === 'cancelled').length,
  };

  const daysLeft = (endDate: string) => {
    if (!endDate) return null;
    const diff = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
    return diff;
  };

  return (
    <Shell title="Members">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--accent)', color: '#000', padding: '12px 20px', borderRadius: 12, fontWeight: 600, fontSize: 13, zIndex: 200, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
          {toast}
        </div>
      )}

      {/* Confirm modal */}
      {confirm && (
        <ConfirmModal
          message={`Deactivate ${confirm.name}'s subscription? They will lose access to this gym immediately.`}
          onConfirm={() => handleDeactivate(confirm.id)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {error && (
        <div className="card p-3 mb-4 text-xs" style={{ color: '#FFB400', background: 'rgba(255,180,0,0.05)', borderColor: 'rgba(255,180,0,0.3)' }}>
          <AlertTriangle size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Total Members', value: stats.total, icon: Users, color: 'var(--accent)' },
          { label: 'Active', value: stats.active, icon: UserCheck, color: '#22c55e' },
          { label: 'Pending', value: stats.pending || 0, icon: Clock, color: '#64A0FF' },
          { label: 'Expired', value: stats.expired, icon: Clock, color: '#FFB400' },
          { label: 'Deactivated', value: stats.cancelled, icon: UserX, color: '#ef4444' },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card stat-glow p-5">
              <div className="flex items-center gap-3 mb-2">
                <Icon size={16} style={{ color: s.color }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--t2)' }}>{s.label}</span>
              </div>
              <div className="text-2xl font-bold">{s.value}</div>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t2)' }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            className="glass-input w-full"
            style={{ paddingLeft: 32 }}
            placeholder="Search members..."
          />
        </div>
        <button onClick={load} className="btn btn-ghost flex items-center gap-2" style={{ fontSize: 13 }}>
          <RefreshCw size={14} /> Refresh
        </button>
        <button onClick={exportCSV} className="btn btn-ghost flex items-center gap-2" style={{ fontSize: 13 }}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className="btn text-xs"
            style={{
              background: statusFilter === f.key ? 'var(--accent)' : 'var(--glass-bg)',
              color: statusFilter === f.key ? '#000' : 'var(--t)',
              border: `1px solid ${statusFilter === f.key ? 'transparent' : 'var(--border-strong)'}`,
              padding: '6px 14px',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass overflow-hidden">
        <table className="glass-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Plan</th>
              <th>Gym Access</th>
              <th>Status</th>
              <th>Start Date</th>
              <th>Expiry</th>
              <th>Trainer</th>
              <th>Gym Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : members.length === 0
                ? <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--t2)', padding: '40px 0' }}>No members found</td></tr>
                : members.map(m => {
                  const days = daysLeft(m.endDate);
                  const expiring = days !== null && days > 0 && days <= 7;
                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#fff', fontSize: 13 }}>{m.name}</div>
                        <div style={{ color: 'var(--t2)', fontSize: 11, fontFamily: 'monospace' }}>{m.phone}</div>
                      </td>
                      <td>
                        <PlanBadge plan={m.planType} />
                        {m.planName && (
                          <div style={{ color: 'var(--t2)', fontSize: 11, marginTop: 5 }}>{m.planName}</div>
                        )}
                      </td>
                      <td><AccessBadge type={m.gymType} count={m.gymCount} /></td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={m.status} />
                          {expiring && <span style={{ fontSize: 10, color: '#FFB400' }}>⚠ {days}d left</span>}
                          {days !== null && days <= 0 && m.status !== 'cancelled' && (
                            <span style={{ fontSize: 10, color: '#ef4444' }}>Expired {Math.abs(days)}d ago</span>
                          )}
                        </div>
                      </td>
                      <td style={{ color: 'var(--t2)', fontSize: 12 }}>
                        {m.startDate ? new Date(m.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {m.endDate
                          ? <span style={{ color: days !== null && days < 0 ? '#ef4444' : expiring ? '#FFB400' : 'var(--t2)' }}>
                              {new Date(m.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                            </span>
                          : <span style={{ color: 'var(--t2)' }}>—</span>}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {m.trainerSummary ? (
                          <div>
                            <div style={{ color: '#fff', fontWeight: 600 }}>{m.trainerSummary}</div>
                            {Number(m.trainerGymAmount || 0) > 0 && (
                              <div style={{ color: 'var(--t2)', fontSize: 11 }}>
                                Trainer: Rs {Number(m.trainerGymAmount || 0).toLocaleString('en-IN')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--t3)' }}>No trainer</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>
                        {m.amountPaid ? `₹${Number(m.amountPaid).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {m.status === 'active' && m.canDeactivate !== false && (
                            <button
                              onClick={() => setConfirm({ id: m.id, name: m.name })}
                              disabled={actionLoading === m.id}
                              title="Deactivate member"
                              style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '5px 10px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <UserX size={12} /> Deactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pages={pages} total={total} limit={limit} onPage={setPage} onLimit={(l) => { setLimit(l); setPage(1); }} />
    </Shell>
  );
}
