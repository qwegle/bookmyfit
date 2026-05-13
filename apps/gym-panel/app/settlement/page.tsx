'use client';
import { useEffect, useState } from 'react';
import Shell from '../../components/Shell';
import { DollarSign, TrendingUp, CheckCircle, Clock, Download, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';

type Settlement = {
  id: string; period: string; grossRevenue: number;
  commission: number; netPayout: number; status: string;
  commissionRate?: number;
};

type CurrentMonth = {
  grossRevenue: number; commission: number; netPayout: number;
  commissionRate: number; status: string; individualPool?: number; multiGymPool?: number; dayPassPool?: number;
};

const EMPTY_CURRENT: CurrentMonth = {
  grossRevenue: 0, commission: 0, netPayout: 0, commissionRate: 0, status: '',
};

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function SkeletonRow() {
  return (
    <tr style={{ opacity: 0.4 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i}><div style={{ height: 14, borderRadius: 6, background: 'rgba(255,255,255,0.08)', animation: 'pulse 1.5s ease-in-out infinite' }} /></td>
      ))}
    </tr>
  );
}

export default function SettlementPage() {
  const { toast } = useToast();
  const [current, setCurrent] = useState<CurrentMonth | null>(null);
  const [past, setPast] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [disputeId, setDisputeId] = useState<string | null>(null);
  const [disputeText, setDisputeText] = useState('');
  const [disputeSent, setDisputeSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const data = await api.get<{ current: CurrentMonth; history: Settlement[] }>('/settlements/my-gym');
        setCurrent({ ...EMPTY_CURRENT, ...(data?.current ?? {}) });
        setPast(data?.history ?? []);
      } catch {
        setCurrent(EMPTY_CURRENT);
        setPast([]);
        setError('API unavailable');
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const raiseDispute = async (id: string) => {
    if (!disputeText.trim()) return;
    try {
      await api.post(`/settlements/${id}/dispute`, { reason: disputeText });
      setDisputeSent(id); setDisputeId(null); setDisputeText('');
      toast('Dispute submitted');
    } catch (e: any) {
      toast(e.message || 'Failed to submit dispute', 'error');
    }
  };

  const c = current ?? EMPTY_CURRENT;
  const bucketRows = [
    { bucket: 'Same Gym Subscriptions', amount: c.individualPool ?? 0 },
    { bucket: 'Day Passes', amount: c.dayPassPool ?? 0 },
    { bucket: 'Multi Gym Allocation', amount: c.multiGymPool ?? 0 },
  ].map((b) => ({ ...b, pct: c.grossRevenue > 0 ? Math.round((b.amount / c.grossRevenue) * 100) : 0 }));

  return (
    <Shell title="My Settlement">
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      {error && (
        <div className="card p-3 mb-4 text-xs" style={{ color: '#FFB400', background: 'rgba(255,180,0,0.05)', borderColor: 'rgba(255,180,0,0.3)' }}><AlertTriangle size={12} style={{ display:"inline", verticalAlign:"middle", marginRight:4 }} /> {error}</div>
      )}

      {/* Current month projected */}
      <div className="glass p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="serif text-lg">Current Month (Projected)</h3>
          <span className="badge-pending">{(c.status || '').replace('_', ' ')}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Gross Revenue', value: fmt(c.grossRevenue), icon: TrendingUp },
            { label: `Commission (${c.commissionRate ?? 0}%)`, value: fmt(c.commission ?? 0), icon: DollarSign },
            { label: 'Net Payout', value: fmt(c.netPayout ?? 0), icon: CheckCircle },
            { label: 'Status', value: (c.status || '—').replace('_', ' ').toUpperCase(), icon: Clock },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="card stat-glow p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={13} style={{ color: 'var(--accent)' }} />
                  <span className="text-xs font-semibold" style={{ color: 'var(--t2)' }}>{s.label}</span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{loading ? '—' : s.value}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Revenue buckets */}
      <div className="glass p-6 mb-6">
        <h3 className="serif text-lg mb-4">Revenue Buckets</h3>
        {loading ? (
          <div style={{ color: 'var(--t2)', fontSize: 13 }}>Loading…</div>
        ) : (
          <div className="space-y-4">
            {[
              ...bucketRows,
            ].map((b) => (
              <div key={b.bucket}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span style={{ fontWeight: 600, color: '#fff' }}>{b.bucket}</span>
                  <span style={{ color: 'var(--t2)' }}>{fmt(b.amount)} <span style={{ color: 'var(--t3)' }}>({b.pct}%)</span></span>
                </div>
                <div style={{ height: 6, borderRadius: 99, background: 'var(--surface)' }}>
                  <div style={{ height: '100%', borderRadius: 99, width: `${b.pct}%`, background: 'linear-gradient(90deg, var(--accent), rgba(61,255,84,0.5))' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past settlements */}
      <div className="glass overflow-hidden">
        <div className="flex items-center justify-between p-6 pb-3">
          <h3 className="serif text-lg">Past Settlements</h3>
          <button className="btn btn-ghost text-xs flex items-center gap-2" style={{ padding: '6px 14px' }}>
            <Download size={13} /> Download Invoice
          </button>
        </div>
        <table className="glass-table">
          <thead>
            <tr><th>Period</th><th>Gross</th><th>Commission</th><th>Net Payout</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
              : past.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600, color: '#fff' }}>{p.period}</td>
                  <td>{fmt(p.grossRevenue)}</td>
                  <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmt(p.commission)}</td>
                  <td style={{ fontWeight: 600 }}>{fmt(p.netPayout)}</td>
                  <td><span className={p.status === 'paid' ? 'badge-active' : p.status === 'approved' ? 'badge-pending' : 'badge-danger'}>{p.status}</span></td>
                  <td>
                    {disputeSent === p.id ? (
                      <span style={{ fontSize: 11, color: 'var(--accent)' }}>Dispute raised <CheckCircle size={12} style={{ display:"inline", verticalAlign:"middle", marginLeft:4 }} color="var(--accent)" /></span>
                    ) : disputeId === p.id ? (
                      <div className="flex items-center gap-2">
                        <input value={disputeText} onChange={(e) => setDisputeText(e.target.value)}
                          className="glass-input text-xs" style={{ padding: '4px 8px', fontSize: 11, width: 140 }}
                          placeholder="Reason…" />
                        <button onClick={() => raiseDispute(p.id)}
                          className="btn text-xs" style={{ padding: '3px 8px', fontSize: 11, background: 'rgba(255,180,0,0.15)', color: '#FFB400', border: '1px solid rgba(255,180,0,0.3)' }}>
                          Send
                        </button>
                        <button onClick={() => setDisputeId(null)} style={{ color: 'var(--t3)', fontSize: 11, cursor: 'pointer' }}><span aria-label="close" style={{ fontSize:14, lineHeight:1 }}>x</span></button>
                      </div>
                    ) : (
                      <button onClick={() => setDisputeId(p.id)}
                        className="btn text-xs flex items-center gap-1"
                        style={{ padding: '4px 10px', fontSize: 11, background: 'rgba(255,60,60,0.1)', color: '#FF6464', border: '1px solid rgba(255,60,60,0.25)' }}>
                        <AlertTriangle size={11} /> Raise Dispute
                      </button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
