'use client';
import { useEffect, useState } from 'react';
import Shell from '../../components/Shell';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';

const PLAN_FEATURES = {
  day_pass: ['Single visit to any partner gym', 'Valid for 24 hours', 'No subscription required'],
  same_gym: ['Gym owner controls base price', 'Unlimited visits to one gym', 'Slot booking included'],
  multi_gym: ['Access all partner gyms', 'Switch gyms anytime', 'Slot booking included'],
  wellness: ['Spa and recovery service bookings', 'Partner service base price', 'Cashfree checkout'],
  personal_training: ['Monthly trainer add-ons', 'Trainer base price from gym portal', 'Cashfree checkout'],
};

type ServiceKey = 'day_pass' | 'same_gym' | 'wellness' | 'personal_training';
type CommissionMode = 'percent' | 'fixed';
type CommissionSetting = { useGlobal: boolean; mode: CommissionMode; value: number };
type GlobalCommission = { mode: CommissionMode; value: number };

const SERVICE_ROWS: Array<{ key: ServiceKey; name: string; description: string; color: string; baseLabel: string; exampleBase: number }> = [
  { key: 'day_pass', name: '1-Day Pass', description: 'Drop-in pass for one gym visit', color: '#00AFFF', baseLabel: 'Default day-pass base', exampleBase: 149 },
  { key: 'same_gym', name: 'Same Gym Pass', description: 'Subscription for one selected gym', color: '#CCFF00', baseLabel: 'Example gym monthly base', exampleBase: 599 },
  { key: 'wellness', name: 'Wellness Services', description: 'Spa, recovery, and home wellness services', color: '#FFB400', baseLabel: 'Example service base', exampleBase: 1000 },
  { key: 'personal_training', name: 'Personal Training', description: 'Monthly trainer booking and subscription add-on', color: '#64A0FF', baseLabel: 'Example trainer monthly base', exampleBase: 3000 },
];

const DEFAULT_SERVICE_COMMISSIONS: Record<ServiceKey, CommissionSetting> = {
  day_pass: { useGlobal: true, mode: 'percent', value: 0 },
  same_gym: { useGlobal: true, mode: 'percent', value: 0 },
  wellness: { useGlobal: true, mode: 'percent', value: 0 },
  personal_training: { useGlobal: true, mode: 'percent', value: 0 },
};

function normalizeGlobal(value: any): GlobalCommission {
  return {
    mode: value?.mode === 'fixed' ? 'fixed' : 'percent',
    value: Math.max(0, Number(value?.value) || 0),
  };
}

function normalizeSetting(value: any, fallback = DEFAULT_SERVICE_COMMISSIONS.day_pass): CommissionSetting {
  return {
    useGlobal: value?.useGlobal !== false,
    mode: value?.mode === 'fixed' ? 'fixed' : 'percent',
    value: Math.max(0, Number(value?.value) || 0),
  };
}

function effective(setting: CommissionSetting, global: GlobalCommission): GlobalCommission {
  return setting.useGlobal ? global : { mode: setting.mode, value: setting.value };
}

function addOn(base: number, commission: GlobalCommission) {
  if (commission.value <= 0) return 0;
  return commission.mode === 'fixed' ? commission.value : base * (commission.value / 100);
}

function money(value: number) {
  return `Rs ${Math.round(value).toLocaleString('en-IN')}`;
}

function commissionLabel(commission: GlobalCommission) {
  return commission.mode === 'fixed' ? `Rs ${commission.value}` : `${commission.value}%`;
}

export default function PlansPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadedFromApi, setLoadedFromApi] = useState(false);
  const [prices, setPrices] = useState({ day_pass: 149, same_gym: 599, multi_gym: 1499 });
  const [globalCommission, setGlobalCommission] = useState<GlobalCommission>({ mode: 'percent', value: 0 });
  const [commissions, setCommissions] = useState<Record<ServiceKey, CommissionSetting>>(DEFAULT_SERVICE_COMMISSIONS);

  useEffect(() => {
    api.get('/subscriptions/plans')
      .then((data: any) => {
        setLoadedFromApi(true);
        setPrices({
          day_pass: data?.day_pass?.basePrice || 149,
          same_gym: data?.same_gym?.basePrice || 599,
          multi_gym: data?.multi_gym?.basePrice || 1499,
        });
        setGlobalCommission(normalizeGlobal(data?.globalCommission));
        setCommissions({
          day_pass: normalizeSetting(data?.day_pass?.commissionSetting),
          same_gym: normalizeSetting(data?.same_gym?.commissionSetting),
          wellness: normalizeSetting(data?.wellness?.commissionSetting),
          personal_training: normalizeSetting(data?.personal_training?.commissionSetting),
        });
      })
      .catch(() => {
        setLoadedFromApi(false);
        toast('Could not load live plan settings. Saving is disabled until the API returns data.', 'error');
      })
      .finally(() => setLoading(false));
  }, [toast]);

  const updateCommission = (key: ServiceKey, patch: Partial<CommissionSetting>) => {
    setCommissions((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));
  };

  const save = async () => {
    if (!loadedFromApi) {
      toast('Live plan settings are not loaded yet. Please refresh before saving.', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.put('/subscriptions/multigym-config', {
        globalCommission,
        day_pass: { basePrice: prices.day_pass, commission: commissions.day_pass },
        same_gym: { commission: commissions.same_gym },
        multi_gym: { basePrice: prices.multi_gym },
        wellness: { commission: commissions.wellness },
        personal_training: { commission: commissions.personal_training },
      });
      toast('Plan and service commission settings updated');
    } catch {
      toast('Failed to save plan settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell title="Plan Management">
      <div style={{ maxWidth: 980 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 className="serif" style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>Plan Management</h1>
          <p style={{ color: 'var(--t2)', fontSize: 14, maxWidth: 760 }}>
            Manage global checkout commission and service-level overrides from one place. User checkout shows the base amount plus the configured add-on.
          </p>
        </div>

        {loading ? (
          <div className="glass p-6">Loading plan settings...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="glass" style={{ padding: 24, borderRadius: 16, borderLeft: '3px solid var(--accent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <h2 className="serif" style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>Global Commission</h2>
                  <p style={{ color: 'var(--t2)', fontSize: 13 }}>
                    Applied to every service that is set to inherit global. Set 0 if no platform add-on should be charged.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <select
                    className="glass-input"
                    style={{ width: 120 }}
                    value={globalCommission.mode}
                    onChange={(e) => setGlobalCommission((current) => ({ ...current, mode: e.target.value === 'fixed' ? 'fixed' : 'percent' }))}
                  >
                    <option value="percent">Percent</option>
                    <option value="fixed">Fixed Rs</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    className="glass-input"
                    style={{ width: 120, textAlign: 'right' }}
                    value={globalCommission.value}
                    onChange={(e) => setGlobalCommission((current) => ({ ...current, value: Math.max(0, Number(e.target.value) || 0) }))}
                  />
                  <span style={{ color: 'var(--t2)', fontSize: 12 }}>{globalCommission.mode === 'fixed' ? 'Rs' : '%'}</span>
                </div>
              </div>
            </div>

            <div className="glass" style={{ padding: 22, borderRadius: 16, borderLeft: '3px solid #9B00FF' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 340px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 900 }}>Multi Gym Pass</span>
                    <span style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: '#9B00FF', background: '#9B00FF22', padding: '2px 8px', borderRadius: 100 }}>platform price</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 10 }}>
                    Admin controls the base monthly pass price. No checkout commission is added on top of this pass.
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {(PLAN_FEATURES.multi_gym || []).map((feature) => (
                      <span key={feature} style={{ fontSize: 11, color: 'var(--t)', background: 'var(--surface)', padding: '3px 10px', borderRadius: 100, border: '1px solid var(--border)' }}>
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ minWidth: 230 }}>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>Monthly base price</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--t2)', fontSize: 13 }}>Rs</span>
                    <input
                      type="number"
                      value={prices.multi_gym}
                      onChange={(e) => setPrices((currentPrices) => ({ ...currentPrices, multi_gym: Number(e.target.value) }))}
                      className="glass-input"
                      style={{ width: 130, textAlign: 'right', fontSize: 18, fontWeight: 700 }}
                    />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 8 }}>
                    User pays <strong style={{ color: '#fff' }}>{money(prices.multi_gym)}</strong> per month.
                  </div>
                </div>
              </div>
            </div>

            {SERVICE_ROWS.map((row) => {
              const setting = commissions[row.key];
              const current = effective(setting, globalCommission);
              const base = row.key === 'day_pass' ? prices.day_pass : row.exampleBase;
              const extra = addOn(base, current);
              const total = base + extra;
              return (
                <div key={row.key} className="glass" style={{ padding: 22, borderRadius: 16, borderLeft: `3px solid ${row.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 320px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 900 }}>{row.name}</span>
                        <span style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: row.color, background: row.color + '22', padding: '2px 8px', borderRadius: 100 }}>{row.key}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 10 }}>{row.description}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {(PLAN_FEATURES[row.key] || []).map((feature) => (
                          <span key={feature} style={{ fontSize: 11, color: 'var(--t)', background: 'var(--surface)', padding: '3px 10px', borderRadius: 100, border: '1px solid var(--border)' }}>
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>

                    {row.key === 'day_pass' && (
                      <div style={{ minWidth: 210 }}>
                        <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>{row.baseLabel}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: 'var(--t2)', fontSize: 13 }}>Rs</span>
                          <input
                            type="number"
                            value={prices[row.key]}
                            onChange={(e) => setPrices((currentPrices) => ({ ...currentPrices, [row.key]: Number(e.target.value) }))}
                            className="glass-input"
                            style={{ width: 120, textAlign: 'right', fontSize: 18, fontWeight: 700 }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(280px, 1.2fr) minmax(190px, 0.8fr)', gap: 14, alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--t)', fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={setting.useGlobal}
                        onChange={(e) => updateCommission(row.key, { useGlobal: e.target.checked })}
                      />
                      Use global commission
                    </label>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: setting.useGlobal ? 0.55 : 1 }}>
                      <select
                        className="glass-input"
                        style={{ width: 118 }}
                        disabled={setting.useGlobal}
                        value={setting.mode}
                        onChange={(e) => updateCommission(row.key, { mode: e.target.value === 'fixed' ? 'fixed' : 'percent' })}
                      >
                        <option value="percent">Percent</option>
                        <option value="fixed">Fixed Rs</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        className="glass-input"
                        style={{ width: 110, textAlign: 'right' }}
                        disabled={setting.useGlobal}
                        value={setting.value}
                        onChange={(e) => updateCommission(row.key, { value: Math.max(0, Number(e.target.value) || 0) })}
                      />
                      <span style={{ color: 'var(--t2)', fontSize: 12 }}>{setting.mode === 'fixed' ? 'Rs' : '%'}</span>
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6 }}>
                      <strong style={{ color: 'var(--accent)' }}>{commissionLabel(current)}</strong> active
                      <br />
                      {money(base)} + {money(extra)} = <strong style={{ color: '#fff' }}>{money(total)}</strong>
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              onClick={save}
              disabled={saving || !loadedFromApi}
              className="btn btn-primary"
              style={{ alignSelf: 'flex-start', opacity: saving || !loadedFromApi ? 0.6 : 1 }}
            >
              {saving ? 'Saving...' : 'Save Plan Settings'}
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}
