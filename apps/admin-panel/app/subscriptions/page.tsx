'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Shell from '../../components/Shell';
import { Building2, CreditCard, IndianRupee, RefreshCw, Search, Users } from 'lucide-react';
import { api } from '../../lib/api';
import Pagination from '../../components/Pagination';

type Sub = {
  id: string;
  userId: string;
  userName?: string;
  userPhone?: string;
  userEmail?: string;
  user?: { name?: string; phone?: string; email?: string };
  planType: 'day_pass' | 'same_gym' | 'multi_gym' | string;
  planName?: string;
  gymName?: string | null;
  gyms?: { id: string; name: string }[];
  accessType?: string;
  startDate: string;
  endDate: string;
  status: string;
  amountPaid: number;
  cashfreeOrderId?: string;
  cashfreePaymentId?: string;
  createdAt: string;
};

const STATUS = ['all', 'active', 'pending', 'expired', 'cancelled'] as const;
const PLAN_LABELS: Record<string, string> = {
  day_pass: '1-Day Pass',
  same_gym: 'Same Gym',
  multi_gym: 'Multi Gym',
};

function fmtDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusStyle(status: string): React.CSSProperties {
  const key = status?.toLowerCase();
  if (key === 'active') return { background: 'rgba(34,197,94,0.14)', color: '#22c55e' };
  if (key === 'pending') return { background: 'rgba(255,180,0,0.14)', color: '#FFB400' };
  if (key === 'cancelled' || key === 'expired') return { background: 'rgba(239,68,68,0.14)', color: '#ef4444' };
  return { background: 'rgba(255,255,255,0.08)', color: 'var(--t2)' };
}

function Badge({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, ...style }}>{children}</span>;
}

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const statusQuery = status !== 'all' ? `&status=${status}` : '';
      const res: any = await api.get(`/subscriptions/all?page=${page}&limit=${limit}${statusQuery}`);
      const rows: Sub[] = Array.isArray(res) ? res : res?.data ?? [];
      setSubs(rows);
      setTotal(res?.total ?? rows.length);
      setPages(res?.pages ?? 1);
    } catch {
      setSubs([]);
      setTotal(0);
      setPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, limit, status]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [status]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return subs;
    return subs.filter((s) => [
      s.userName, s.userPhone, s.userEmail, s.user?.name, s.user?.phone, s.user?.email,
      s.planName, s.planType, s.gymName, s.cashfreeOrderId,
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle)));
  }, [q, subs]);

  const stats = {
    active: subs.filter((s) => s.status === 'active').length,
    pending: subs.filter((s) => s.status === 'pending').length,
    revenue: subs.reduce((sum, s) => sum + Number(s.amountPaid || 0), 0),
    singleGym: subs.filter((s) => s.planType === 'same_gym' || s.planType === 'day_pass').length,
  };

  return (
    <Shell title="Subscription Tracker">
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Shown', value: loading ? '-' : String(total), icon: CreditCard },
          { label: 'Active', value: loading ? '-' : String(stats.active), icon: Users },
          { label: 'Pending Payment', value: loading ? '-' : String(stats.pending), icon: RefreshCw },
          { label: 'Gross Amount', value: loading ? '-' : `Rs ${stats.revenue.toLocaleString('en-IN')}`, icon: IndianRupee },
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

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1" style={{ minWidth: 260 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t2)' }} />
          <input className="glass-input w-full" style={{ paddingLeft: 32 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search user, gym, plan, order ID..." />
        </div>
        <button className="btn btn-ghost flex items-center gap-2" onClick={load}><RefreshCw size={14} /> Refresh</button>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {STATUS.map((item) => (
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
            {item}
          </button>
        ))}
      </div>

      <div className="glass overflow-hidden">
        <table className="glass-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Plan</th>
              <th>Gym Access</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Start</th>
              <th>Expiry</th>
              <th>Cashfree</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--t2)', padding: 40 }}>Loading subscriptions...</td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--t2)', padding: 40 }}>No subscriptions found</td></tr>
            ) : visible.map((s) => {
              const userName = s.userName || s.user?.name || s.userPhone || `User-${String(s.userId).slice(0, 6)}`;
              const phone = s.userPhone || s.user?.phone || s.userEmail || s.user?.email || '-';
              const gymText = s.planType === 'multi_gym' ? 'All Partner Gyms' : (s.gymName || s.gyms?.map((g) => g.name).join(', ') || '-');
              return (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 700, color: '#fff', fontSize: 13 }}>{userName}</div>
                    <div style={{ color: 'var(--t2)', fontSize: 11, fontFamily: 'monospace' }}>{phone}</div>
                  </td>
                  <td>
                    <Badge style={{ background: 'rgba(204,255,0,0.12)', color: 'var(--accent)' }}>
                      {s.planName || PLAN_LABELS[s.planType] || s.planType}
                    </Badge>
                    <div style={{ color: 'var(--t3)', fontSize: 11, marginTop: 5 }}>{PLAN_LABELS[s.planType] || s.planType}</div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2" style={{ color: 'var(--t)' }}>
                      <Building2 size={13} style={{ color: 'var(--accent)' }} />
                      <span>{gymText}</span>
                    </div>
                  </td>
                  <td><Badge style={statusStyle(s.status)}>{s.status}</Badge></td>
                  <td style={{ fontWeight: 800, color: '#fff' }}>Rs {Number(s.amountPaid || 0).toLocaleString('en-IN')}</td>
                  <td style={{ color: 'var(--t2)', fontSize: 12 }}>{fmtDate(s.startDate)}</td>
                  <td style={{ color: 'var(--t2)', fontSize: 12 }}>{fmtDate(s.endDate)}</td>
                  <td style={{ color: 'var(--t3)', fontSize: 11, fontFamily: 'monospace' }}>
                    {s.cashfreeOrderId ? s.cashfreeOrderId : '-'}
                    {s.cashfreePaymentId && <div style={{ color: 'var(--accent)' }}>{s.cashfreePaymentId}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={pages} total={total} limit={limit} onPage={setPage} onLimit={(next) => { setLimit(next); setPage(1); }} />
    </Shell>
  );
}
