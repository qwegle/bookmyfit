'use client';
import { useCallback, useEffect, useState } from 'react';
import Shell from '../../components/Shell';
import { DollarSign, TrendingUp, Clock, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import Pagination from '../../components/Pagination';

type Settlement = {
  id: string; gymId?: string; gymName: string; period: string;
  grossRevenue: number; commission: number; netPayout: number; status: string;
};

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = { pending: 'badge-pending', approved: 'badge-active', paid: '' };
  const paidStyle: React.CSSProperties = { background: 'rgba(100,160,255,0.15)', color: '#64A0FF', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 };
  if (status === 'paid') return <span style={paidStyle}>Paid</span>;
  return <span className={cls[status] || 'badge-pending'}>{status}</span>;
}

function SkeletonRow() {
  return (
    <tr style={{ opacity: 0.4 }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i}><div style={{ height: 14, borderRadius: 6, background: 'rgba(255,255,255,0.08)', animation: 'pulse 1.5s ease-in-out infinite' }} /></td>
      ))}
    </tr>
  );
}

export default function SettlementsPage() {
  const { toast } = useToast();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(currentYearMonth());
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get<any>(`/settlements?page=${page}&limit=${limit}${q ? `&search=${encodeURIComponent(q)}` : ''}`);
      const rows: Settlement[] = Array.isArray(res) ? res : (res as any)?.data ?? [];
      setSettlements(rows);
      setTotal((res as any)?.total ?? rows.length);
      setPages((res as any)?.pages ?? 1);
    } catch {
      setSettlements([]);
      setTotal(0);
      setPages(1);
      setError('Failed to load settlements');
    } finally { setLoading(false); }
  }, [page, limit, q]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [q]);

  const approveSettlement = async (id: string) => {
    try {
      await api.post(`/settlements/${id}/approve`);
      setSettlements((prev) => prev.map((s) => s.id === id ? { ...s, status: 'approved' } : s));
      toast('Settlement approved');
    } catch (e: any) {
      toast(e.message || 'Failed to approve settlement', 'error');
    }
  };
  const markPaid = async (id: string) => {
    try {
      await api.post(`/settlements/${id}/pay`);
      setSettlements((prev) => prev.map((s) => s.id === id ? { ...s, status: 'paid' } : s));
      toast('Settlement marked paid');
    } catch (e: any) {
      toast(e.message || 'Failed to mark settlement paid', 'error');
    }
  };

  const handleGenerate = async () => {
    if (!selectedPeriod) { toast('Select a period', 'error'); return; }
    setGenerating(true);
    try {
      await api.post('/settlements/generate', { period: selectedPeriod });
      toast(`Settlement generated for ${selectedPeriod}`);
      setShowGenerate(false);
      load();
    } catch (e: any) {
      toast(e.message || 'Failed to generate settlement', 'error');
    } finally { setGenerating(false); }
  };

  const filtered = settlements.filter((s) => !q || s.gymName.toLowerCase().includes(q.toLowerCase()));

  const totalGross = settlements.reduce((a, s) => a + s.grossRevenue, 0);
  const totalCommission = settlements.reduce((a, s) => a + s.commission, 0);
  const pendingPayouts = settlements.filter((s) => s.status === 'pending').reduce((a, s) => a + s.netPayout, 0);
  const paid = settlements.filter((s) => s.status === 'paid').reduce((a, s) => a + s.netPayout, 0);

  // Build last 12 months for dropdown
  const periodOptions: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periodOptions.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  return (
    <Shell title="Settlements">
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      {error && (
        <div className="card p-3 mb-4 text-xs" style={{ color: '#FFB400', borderColor: 'rgba(255,180,0,0.3)', background: 'rgba(255,180,0,0.05)' }}><AlertTriangle size={12} style={{ display:"inline", verticalAlign:"middle", marginRight:4 }} /> {error}</div>
      )}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Gross Revenue', value: fmt(totalGross), icon: TrendingUp },
          { label: 'Platform Commission', value: fmt(totalCommission), icon: DollarSign },
          { label: 'Pending Payouts', value: fmt(pendingPayouts), icon: Clock },
          { label: 'Paid This Cycle', value: fmt(paid), icon: CheckCircle },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card stat-glow p-5">
              <div className="flex items-center gap-3 mb-2">
                <Icon size={16} style={{ color: 'var(--accent)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--t2)' }}>{s.label}</span>
              </div>
              <div className="text-2xl font-bold">{s.value}</div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mb-5">
        <input value={q} onChange={(e) => setQ(e.target.value)} className="glass-input flex-1" placeholder="Search by gym name..." />
        <button onClick={load} className="btn btn-ghost text-sm">Refresh</button>
        <button className="btn btn-primary text-sm" onClick={() => setShowGenerate(true)}>Generate Settlement</button>
      </div>

      <div className="glass overflow-hidden">
        <table className="glass-table">
          <thead>
            <tr>
              <th>Gym Name</th><th>Period</th><th>Gross Revenue</th>
              <th>Commission</th><th>Net Payout</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : filtered.length === 0
                ? <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--t2)', padding: '40px 0' }}>No settlements found</td></tr>
                : filtered.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600, color: '#fff' }}>{s.gymName}</td>
                    <td style={{ color: 'var(--t2)' }}>{s.period}</td>
                    <td>{fmt(s.grossRevenue)}</td>
                    <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmt(s.commission)}</td>
                    <td style={{ fontWeight: 600 }}>{fmt(s.netPayout)}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td>
                      <div className="flex items-center gap-2">
                        {s.status === 'pending' && (
                          <button onClick={() => approveSettlement(s.id)}
                            className="btn btn-primary text-xs" style={{ padding: '4px 10px', fontSize: 11 }}>
                            Approve
                          </button>
                        )}
                        {s.status === 'approved' && (
                          <button onClick={() => markPaid(s.id)}
                            className="btn text-xs" style={{ padding: '4px 10px', fontSize: 11, background: 'rgba(100,160,255,0.2)', color: '#64A0FF', border: '1px solid rgba(100,160,255,0.4)' }}>
                            Mark Paid
                          </button>
                        )}
                        {s.status === 'paid' && (
                          <span style={{ fontSize: 11, color: 'var(--t3)' }}>—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={pages} total={total} limit={limit} onPage={setPage} onLimit={(l) => { setLimit(l); setPage(1); }} />

      {/* Generate Settlement Modal */}
      {showGenerate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowGenerate(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 28, width: 400, maxWidth: '90vw' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 20, color: '#fff', margin: 0 }}>Generate Settlement</h3>
              <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => setShowGenerate(false)}><X size={16} /></button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="kicker block mb-2">Billing Period</label>
              <select
                className="glass-input w-full"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
              >
                {periodOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 8 }}>
                Generates settlement records for all gyms in the selected month.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-ghost flex-1" onClick={() => setShowGenerate(false)}>Cancel</button>
              <button className="btn btn-primary flex-1" onClick={handleGenerate} disabled={generating}>
                {generating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
