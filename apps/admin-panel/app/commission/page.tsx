'use client';
import { useEffect, useState } from 'react';
import Shell from '../../components/Shell';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';

type CommissionRate = { id: string; planType: string; commission: number; minGyms: number; maxGyms: number };

export default function CommissionPage() {
  const { toast } = useToast();
  const [rates, setRates] = useState<CommissionRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ commission: 0, minGyms: 0, maxGyms: 0 });

  const load = async () => {
    try {
      const data = await api.get<CommissionRate[]>('/commission/rates');
      setRates(Array.isArray(data) ? data : []);
    } catch {
      setRates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const startEdit = (r: CommissionRate) => {
    setEditingId(r.id);
    setEditValues({ commission: r.commission, minGyms: r.minGyms, maxGyms: r.maxGyms });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: string) => {
    try {
      await api.put(`/commission/rates/${id}`, editValues);
      toast('Commission rate saved');
      await load();
    } catch {
      toast('Failed to save commission rate', 'error');
    }
    setEditingId(null);
  };

  const avgCommission = rates.length
    ? `${(rates.reduce((a, r) => a + Number(r.commission || 0), 0) / rates.length).toFixed(1)}%`
    : '--';
  const maxCoverage = rates.some((r) => r.maxGyms >= 999)
    ? 'Unlimited'
    : rates.length ? String(Math.max(...rates.map((r) => r.maxGyms || 0))) : '--';

  return (
    <Shell title="Commission Settings">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Configured Plan Types', value: loading ? '...' : String(rates.length) },
          { label: 'Avg Commission Rate', value: loading ? '...' : avgCommission },
          { label: 'Max Gym Coverage', value: loading ? '...' : maxCoverage },
        ].map((s) => (
          <div key={s.label} className="card stat-glow p-5">
            <div className="text-2xl font-bold mb-1">{s.value}</div>
            <div className="text-xs" style={{ color: 'var(--t2)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Plan Types Table */}
      <div className="glass p-6">
        <h3 className="serif text-lg mb-4">Plan Commission Rates</h3>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse h-8 rounded mb-2" style={{ background: 'var(--surface)' }} />
          ))
        ) : (
          <table className="glass-table">
            <thead>
              <tr>
                <th>Plan Type</th>
                <th>Commission %</th>
                <th>Min Gyms</th>
                <th>Max Gyms</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.id}>
                  <td className="font-semibold text-white">{r.planType}</td>
                  {editingId === r.id ? (
                    <>
                      <td>
                        <input
                          type="number"
                          className="glass-input w-16 text-center"
                          value={editValues.commission}
                          onChange={(e) => setEditValues((v) => ({ ...v, commission: Number(e.target.value) }))}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="glass-input w-16 text-center"
                          value={editValues.minGyms}
                          onChange={(e) => setEditValues((v) => ({ ...v, minGyms: Number(e.target.value) }))}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="glass-input w-16 text-center"
                          value={editValues.maxGyms}
                          onChange={(e) => setEditValues((v) => ({ ...v, maxGyms: Number(e.target.value) }))}
                        />
                      </td>
                      <td className="flex gap-2">
                        <button className="btn btn-primary text-xs" onClick={() => saveEdit(r.id)}>Save</button>
                        <button className="btn btn-ghost text-xs" onClick={cancelEdit}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ color: 'var(--accent)' }}>{r.commission}%</td>
                      <td>{r.minGyms}</td>
                      <td>{r.maxGyms === 999 ? 'Unlimited' : r.maxGyms}</td>
                      <td>
                        <button className="btn btn-ghost text-xs" onClick={() => startEdit(r)}>Edit</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Shell>
  );
}
