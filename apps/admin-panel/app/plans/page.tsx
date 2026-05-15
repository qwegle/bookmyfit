'use client';
import { useState, useEffect } from 'react';
import Shell from '../../components/Shell';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';

const PLAN_FEATURES = {
  day_pass: ['Single visit to any partner gym', 'Valid for 24 hours', 'No subscription required', 'Buy anytime, any number'],
  same_gym: ['Unlimited visits to one gym', 'Slot booking included', 'Monthly subscription', 'QR check-in'],
  multi_gym: ['Access all partner gyms', 'Switch gyms anytime', 'Slot booking included', 'Priority support'],
};

type PassCommission = { mode: 'percent' | 'fixed'; value: number };
const DEFAULT_PASS_COMMISSION: Record<'day_pass' | 'same_gym', PassCommission> = {
  day_pass: { mode: 'percent', value: 0 },
  same_gym: { mode: 'percent', value: 0 },
};

function normalizeCommission(value: any): PassCommission {
  return {
    mode: value?.mode === 'fixed' ? 'fixed' : 'percent',
    value: Math.max(0, Number(value?.value) || 0),
  };
}

export default function PlansPage() {
  const { toast } = useToast();
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prices, setPrices] = useState({ day_pass: 149, same_gym: 599, multi_gym: 1499 });
  const [commissions, setCommissions] = useState(DEFAULT_PASS_COMMISSION);

  useEffect(() => {
    api.get('/subscriptions/plans')
      .then((data: any) => {
        setConfig(data);
        setPrices({
          day_pass: data?.day_pass?.basePrice || 149,
          same_gym: data?.same_gym?.basePrice || 599,
          multi_gym: data?.multi_gym?.basePrice || 1499,
        });
        setCommissions({
          day_pass: normalizeCommission(data?.day_pass?.commission),
          same_gym: normalizeCommission(data?.same_gym?.commission),
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/subscriptions/multigym-config', {
        multi_gym: { basePrice: prices.multi_gym },
        day_pass: { basePrice: prices.day_pass, commission: commissions.day_pass },
        same_gym: { commission: commissions.same_gym },
      });
      toast('Plan prices updated successfully');
    } catch {
      toast('Failed to save plan prices', 'error');
    } finally {
      setSaving(false);
    }
  };

  const plans = [
    { key: 'day_pass', name: '1-Day Pass', description: 'Drop-in pass for a single visit', color: '#00AFFF', priceLabel: 'per visit' },
    { key: 'same_gym', name: 'Same Gym Pass', description: 'Monthly pass for a single gym', color: '#CCFF00', priceLabel: 'per month', note: 'Gym-specific pricing is set by each gym owner in Gym Management.' },
    { key: 'multi_gym', name: 'Multi Gym Pass', description: 'Monthly pass for all partner gyms', color: '#9B00FF', priceLabel: 'per month' },
  ];

  const updateCommission = (key: 'day_pass' | 'same_gym', patch: Partial<PassCommission>) => {
    setCommissions((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));
  };

  return (
    <Shell title="Plan Management">
      <div style={{ maxWidth: 800 }}>
        <div style={{ marginBottom: 32 }}>
          <h1 className="serif" style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>Plan Management</h1>
          <p style={{ color: 'var(--t2)', fontSize: 14 }}>
            Configure the 3 subscription tiers available to users.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass p-6 animate-pulse" style={{ borderRadius: 16 }}>
                <div className="h-6 rounded mb-3" style={{ background: 'var(--surface)', width: '40%' }} />
                <div className="h-4 rounded mb-2" style={{ background: 'var(--surface)', width: '60%' }} />
                <div className="h-4 rounded" style={{ background: 'var(--surface)', width: '30%' }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {plans.map(plan => (
              <div key={plan.key} className="glass" style={{ padding: 24, borderRadius: 16, borderLeft: `3px solid ${plan.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 900 }}>{plan.name}</span>
                      <span style={{ fontSize: 10, fontFamily: 'var(--sans)', letterSpacing: 1, textTransform: 'uppercase', color: plan.color, background: plan.color + '22', padding: '2px 8px', borderRadius: 100 }}>{plan.key}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--t2)' }}>{plan.description}</div>
                  </div>

                  {plan.key !== 'same_gym' ? (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>Base price ({plan.priceLabel})</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: 'var(--t2)', fontSize: 16 }}>₹</span>
                        <input
                          type="number"
                          value={prices[plan.key as keyof typeof prices]}
                          onChange={e => setPrices(p => ({ ...p, [plan.key]: Number(e.target.value) }))}
                          className="glass-input"
                          style={{ width: 100, textAlign: 'right', fontSize: 18, fontWeight: 700 }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--t3)', textAlign: 'right', maxWidth: 200 }}>
                      Pricing set by gym owners
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(PLAN_FEATURES[plan.key as keyof typeof PLAN_FEATURES] || []).map((f: string) => (
                    <span key={f} style={{ fontSize: 11, color: 'var(--t)', background: 'var(--surface)', padding: '3px 10px', borderRadius: 100, border: '1px solid var(--border)' }}>
                      ✓ {f}
                    </span>
                  ))}
                </div>

                {(plan.key === 'day_pass' || plan.key === 'same_gym') && (
                  <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--t)' }}>Checkout commission</div>
                        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 3 }}>
                          Added to user checkout. Gym base pricing stays unchanged. Set 0 for no commission.
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <select
                          className="glass-input"
                          style={{ width: 112 }}
                          value={commissions[plan.key as 'day_pass' | 'same_gym'].mode}
                          onChange={(e) => updateCommission(plan.key as 'day_pass' | 'same_gym', { mode: e.target.value === 'fixed' ? 'fixed' : 'percent' })}
                        >
                          <option value="percent">Percent</option>
                          <option value="fixed">Fixed Rs</option>
                        </select>
                        <input
                          type="number"
                          min={0}
                          className="glass-input"
                          style={{ width: 100, textAlign: 'right' }}
                          value={commissions[plan.key as 'day_pass' | 'same_gym'].value}
                          onChange={(e) => updateCommission(plan.key as 'day_pass' | 'same_gym', { value: Math.max(0, Number(e.target.value) || 0) })}
                        />
                        <span style={{ color: 'var(--t2)', fontSize: 12 }}>
                          {commissions[plan.key as 'day_pass' | 'same_gym'].mode === 'fixed' ? 'Rs' : '%'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {(plan as any).note && (
                  <div style={{ marginTop: 12, fontSize: 12, color: 'var(--t3)', fontStyle: 'italic' }}>
                    ℹ️ {(plan as any).note}
                  </div>
                )}
              </div>
            ))}

            <button
              onClick={save}
              disabled={saving}
              className="btn btn-primary"
              style={{ alignSelf: 'flex-start', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving…' : 'Save Plan Prices'}
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}
