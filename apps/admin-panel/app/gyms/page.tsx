'use client';
import { useCallback, useEffect, useState } from 'react';
import Shell from '../../components/Shell';
import { CheckCircle, Clock, XCircle, PauseCircle, Star, ChevronDown, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import Pagination from '../../components/Pagination';

type Gym = {
  id: string; name: string; city: string; area?: string;
  tier: string; status: string; rating: number; commissionRate: number;
};

const TIERS = ['Standard', 'Premium', 'Corporate Exclusive'];
const STATUS_FILTERS = ['all', 'active', 'pending', 'suspended', 'rejected'] as const;

function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, React.CSSProperties> = {
    'Standard': { background: 'rgba(100,160,255,0.15)', color: '#64A0FF' },
    'Premium': { background: 'rgba(255,180,0,0.15)', color: '#FFB400' },
    'Corporate Exclusive': { background: 'rgba(180,120,255,0.15)', color: '#B478FF' },
  };
  const s = styles[tier] || styles['Standard'];
  return (
    <span style={{ ...s, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
      {tier}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    active: 'badge-active', pending: 'badge-pending',
    suspended: 'badge-danger', rejected: 'badge-danger',
  };
  return <span className={cls[status] || 'badge-pending'}>{status}</span>;
}

function SkeletonRow() {
  return (
    <tr style={{ opacity: 0.4 }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i}>
          <div style={{ height: 14, borderRadius: 6, background: 'rgba(255,255,255,0.08)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </td>
      ))}
    </tr>
  );
}

export default function GymsPage() {
  const { toast } = useToast();
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>('all');
  const [tierDropdown, setTierDropdown] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get<any>(`/gyms?page=${page}&limit=${limit}${q ? `&search=${encodeURIComponent(q)}` : ''}`);
      const rows: Gym[] = Array.isArray(res) ? res : (res as any)?.data ?? [];
      setGyms(rows);
      setTotal((res as any)?.total ?? rows.length);
      setPages((res as any)?.pages ?? 1);
    } catch {
      setGyms([]);
      setTotal(0);
      setPages(1);
      setError('Failed to load gyms. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, q]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [q]);

  const approve = async (id: string) => {
    try {
      await api.post(`/gyms/${id}/approve`);
      setGyms((prev) => prev.map((g) => g.id === id ? { ...g, status: 'active' } : g));
      toast('Gym approved');
    } catch (e: any) {
      toast(e.message || 'Failed to approve gym', 'error');
    }
  };
  const suspend = async (id: string) => {
    try {
      await api.post(`/gyms/${id}/suspend`);
      setGyms((prev) => prev.map((g) => g.id === id ? { ...g, status: 'suspended' } : g));
      toast('Gym suspended');
    } catch (e: any) {
      toast(e.message || 'Failed to suspend gym', 'error');
    }
  };
  const setTier = async (gym: Gym, tier: string) => {
    try {
      await api.put(`/gyms/${gym.id}/tier`, { tier, commissionRate: gym.commissionRate ?? 15 });
      setGyms((prev) => prev.map((g) => g.id === gym.id ? { ...g, tier } : g));
      setTierDropdown(null);
      toast('Gym tier updated');
    } catch (e: any) {
      toast(e.message || 'Failed to update gym tier', 'error');
    }
  };

  const filtered = gyms.filter((g) => {
    const matchStatus = statusFilter === 'all' || g.status === statusFilter;
    return matchStatus;
  });

  const stats = {
    active: gyms.filter((g) => g.status === 'active').length,
    pending: gyms.filter((g) => g.status === 'pending').length,
    suspended: gyms.filter((g) => g.status === 'suspended').length,
    rejected: gyms.filter((g) => g.status === 'rejected').length,
  };

  return (
    <Shell title="Gym Management">
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      {error && (
        <div className="card p-3 mb-4 text-xs" style={{ color: '#FFB400', borderColor: 'rgba(255,180,0,0.3)', background: 'rgba(255,180,0,0.05)' }}>
          <AlertTriangle size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> {error}
        </div>
      )}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Active Gyms', value: stats.active, icon: CheckCircle, color: 'var(--accent)' },
          { label: 'Pending Review', value: stats.pending, icon: Clock, color: '#FFB400' },
          { label: 'Suspended', value: stats.suspended, icon: PauseCircle, color: '#FF8C00' },
          { label: 'Rejected', value: stats.rejected, icon: XCircle, color: '#FF3C3C' },
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

      <div className="flex items-center gap-3 mb-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} className="glass-input flex-1"
          placeholder="Search gyms by name or city..." />
      </div>

      <div className="flex gap-2 mb-5">
        {STATUS_FILTERS.map((f) => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className="btn text-xs capitalize"
            style={{
              background: statusFilter === f ? 'var(--accent)' : 'var(--glass-bg)',
              color: statusFilter === f ? '#000' : 'var(--t)',
              border: `1px solid ${statusFilter === f ? 'transparent' : 'var(--border-strong)'}`,
              padding: '6px 14px',
            }}>
            {f === 'all' ? 'All Gyms' : f}
          </button>
        ))}
      </div>

      <div className="glass overflow-hidden" style={{ position: 'relative' }}>
        <table className="glass-table">
          <thead>
            <tr>
              <th>Gym Name</th><th>City</th><th>Tier</th><th>Status</th>
              <th>Commission %</th><th>Rating</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : filtered.length === 0
                ? <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--t2)', padding: '40px 0' }}>No gyms found</td></tr>
                : filtered.map((g) => (
                  <tr key={g.id} style={{ position: 'relative' }}>
                    <td className="font-semibold" style={{ color: '#fff' }}>{g.name}</td>
                    <td>{g.city}{g.area ? `, ${g.area}` : ''}</td>
                    <td><TierBadge tier={g.tier} /></td>
                    <td><StatusBadge status={g.status} /></td>
                    <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{g.commissionRate ?? 15}%</td>
                    <td><Star size={12} color="#FFB400" fill="#FFB400" style={{ display:'inline', verticalAlign:'middle', marginRight:3 }} />{g.rating ?? '--'}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        {g.status === 'pending' && (
                          <button onClick={() => approve(g.id)}
                            className="btn btn-primary text-xs" style={{ padding: '4px 10px', fontSize: 11 }}>
                            Approve
                          </button>
                        )}
                        {g.status === 'active' && (
                          <button onClick={() => suspend(g.id)}
                            className="btn text-xs" style={{ padding: '4px 10px', fontSize: 11, background: 'rgba(255,60,60,0.15)', color: '#FF3C3C', border: '1px solid rgba(255,60,60,0.3)' }}>
                            Suspend
                          </button>
                        )}
                        <div style={{ position: 'relative' }}>
                          <button onClick={() => setTierDropdown(tierDropdown === g.id ? null : g.id)}
                            className="btn btn-ghost text-xs" style={{ padding: '4px 10px', fontSize: 11 }}>
                            Set Tier <ChevronDown size={12} style={{ display:'inline', verticalAlign:'middle' }} />
                          </button>
                          {tierDropdown === g.id && (
                            <div className="glass" style={{ position: 'absolute', right: 0, top: '110%', zIndex: 50, minWidth: 160, padding: '6px 0' }}>
                              {TIERS.map((t) => (
                                <button key={t} onClick={() => setTier(g, t)}
                                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 12, color: g.tier === t ? 'var(--accent)' : 'var(--t)', background: 'transparent', cursor: 'pointer' }}>
                                  {t} {g.tier === t && <span style={{ color:'var(--accent)' }}>&#10003;</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={pages} total={total} limit={limit} onPage={setPage} onLimit={(l) => { setLimit(l); setPage(1); }} />
    </Shell>
  );
}
