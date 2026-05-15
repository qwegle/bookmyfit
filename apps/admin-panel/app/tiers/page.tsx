'use client';
import { useState, useEffect } from 'react';
import Shell from '../../components/Shell';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { Award, TrendingUp } from 'lucide-react';

type Gym = {
  id: string;
  name: string;
  city: string;
  status: string;
  tier: string;
  commissionRate: number;
};

type EditState = {
  tier: string;
  commissionRate: number;
};

const TIERS = ['Elite', 'Premium', 'Standard'] as const;

function tierBadge(tier: string): React.CSSProperties {
  if (tier === 'Elite') return { background: 'rgba(61,255,84,0.15)', color: '#3DFF54' };
  if (tier === 'Premium') return { background: 'rgba(155,0,255,0.15)', color: '#9B59B6' };
  return { background: 'rgba(255,138,0,0.15)', color: '#FF8A00' };
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') return <span className="badge-active">Active</span>;
  if (status === 'rejected') return <span className="badge-danger">Rejected</span>;
  return <span className="badge-pending">{status || 'Pending'}</span>;
}

function SkeletonRow() {
  return (
    <tr style={{ opacity: 0.4 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i}>
          <div style={{ height: 14, borderRadius: 6, background: 'rgba(255,255,255,0.08)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </td>
      ))}
    </tr>
  );
}

export default function TiersPage() {
  const { toast } = useToast();
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data: any = await api.get('/gyms/admin/list?limit=200');
        setGyms(Array.isArray(data) ? data : data?.data ?? []);
      } catch {
        setGyms([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const startEdit = (g: Gym) => {
    setEdits((prev) => ({
      ...prev,
      [g.id]: { tier: g.tier || 'Standard', commissionRate: g.commissionRate ?? 15 },
    }));
  };

  const cancelEdit = (id: string) => {
    setEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSave = async (id: string) => {
    const edit = edits[id];
    if (!edit) return;
    setSaving(id);
    try {
      await api.post(`/gyms/${id}/tier`, { tier: edit.tier, commissionRate: edit.commissionRate });
      setGyms((prev) => prev.map((g) => g.id === id ? { ...g, tier: edit.tier, commissionRate: edit.commissionRate } : g));
      cancelEdit(id);
      toast('Tier updated');
    } catch (e: any) {
      toast(e.message || 'Update failed', 'error');
    } finally {
      setSaving(null);
    }
  };

  const elite = gyms.filter((g) => g.tier === 'Elite').length;
  const premium = gyms.filter((g) => g.tier === 'Premium').length;
  const standard = gyms.filter((g) => !g.tier || g.tier === 'Standard').length;
  const avgCommission = gyms.length > 0
    ? (gyms.reduce((s, g) => s + (g.commissionRate ?? 15), 0) / gyms.length).toFixed(1)
    : '—';

  return (
    <Shell title="Tier Management">
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Elite Gyms', value: elite, color: '#3DFF54' },
          { label: 'Premium Gyms', value: premium, color: '#9B59B6' },
          { label: 'Standard Gyms', value: standard, color: '#FF8A00' },
          { label: 'Avg Commission', value: `${avgCommission}%`, color: '#00AFFF' },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <div className="flex items-center gap-3 mb-2">
              {s.label === 'Avg Commission'
                ? <TrendingUp size={16} style={{ color: s.color }} />
                : <Award size={16} style={{ color: s.color }} />}
              <span className="text-xs font-semibold" style={{ color: 'var(--t2)' }}>{s.label}</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="glass overflow-hidden">
        <table className="glass-table">
          <thead>
            <tr>
              <th>Gym Name</th>
              <th>City</th>
              <th>Status</th>
              <th>Current Tier</th>
              <th>Commission %</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : gyms.length === 0
                ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--t2)', padding: '60px 0' }}>
                      <Award size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                      <div style={{ fontSize: 14 }}>No gyms found</div>
                    </td>
                  </tr>
                )
                : gyms.map((g) => {
                  const isEditing = Boolean(edits[g.id]);
                  const edit = edits[g.id];
                  return (
                    <tr key={g.id}>
                      <td className="font-semibold" style={{ color: '#fff' }}>{g.name}</td>
                      <td style={{ color: 'var(--t2)' }}>{g.city}</td>
                      <td><StatusBadge status={g.status} /></td>
                      <td>
                        {isEditing ? (
                          <select
                            value={edit.tier}
                            onChange={(e) => setEdits((prev) => ({ ...prev, [g.id]: { ...edit, tier: e.target.value } }))}
                            className="glass-input"
                            style={{ padding: '4px 10px', fontSize: 12, minWidth: 120 }}>
                            {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        ) : (
                          <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, ...tierBadge(g.tier || 'Standard') }}>
                            {g.tier || 'Standard'}
                          </span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={edit.commissionRate}
                            onChange={(e) => setEdits((prev) => ({ ...prev, [g.id]: { ...edit, commissionRate: Number(e.target.value) } }))}
                            className="glass-input"
                            style={{ padding: '4px 10px', fontSize: 12, width: 80 }}
                          />
                        ) : (
                          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{g.commissionRate ?? 15}%</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSave(g.id)}
                                disabled={saving === g.id}
                                className="btn btn-primary text-xs"
                                style={{ padding: '4px 12px', fontSize: 11 }}>
                                {saving === g.id ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                onClick={() => cancelEdit(g.id)}
                                className="btn btn-ghost text-xs"
                                style={{ padding: '4px 10px', fontSize: 11 }}>
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => startEdit(g)}
                              className="btn btn-ghost text-xs"
                              style={{ padding: '4px 10px', fontSize: 11 }}>
                              Edit
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
    </Shell>
  );
}
