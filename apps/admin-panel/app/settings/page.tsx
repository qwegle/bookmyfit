'use client';
import { useEffect, useState } from 'react';
import Shell from '../../components/Shell';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { Save, Plus, X } from 'lucide-react';

const DEFAULTS = {
  commission: { standard: 15, premium: 12, corporate: 10 },
  settlements: { cycle: 'Monthly', minPayout: 5000, processingWindow: 7 },
  flags: { storeModule: true, wellnessBooking: true, aiRecommendations: false, corporatePortal: true, mapView: false },
};

const MULTIGYM_DEFAULTS = {
  pro: { name: 'Multi-Gym Pro', basePrice: 999, gymLimit: 5 },
  max: { name: 'Multi-Gym Max', basePrice: 1999, gymLimit: null },
};

type Settings = typeof DEFAULTS;
type MultigymConfig = typeof MULTIGYM_DEFAULTS;

interface AdminUser { id: string; name: string; email: string; role: string; lastLogin?: string; isActive?: boolean; }

function mergeSettings(value: any): Settings {
  return {
    commission: { ...DEFAULTS.commission, ...(value?.commission || {}) },
    settlements: { ...DEFAULTS.settlements, ...(value?.settlements || {}) },
    flags: { ...DEFAULTS.flags, ...(value?.flags || {}) },
  };
}

function mapAdminUser(u: any): AdminUser {
  return {
    id: u.id ?? u._id,
    name: u.name ?? u.email ?? 'Admin',
    email: u.email ?? '',
    role: String(u.role ?? 'super_admin').replace(/_/g, ' '),
    lastLogin: u.lastLogin ?? u.updatedAt ?? '',
    isActive: u.isActive !== false,
  };
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [multigym, setMultigym] = useState<MultigymConfig>(MULTIGYM_DEFAULTS);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMg, setSavingMg] = useState(false);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '' });

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const data = await api.get('/admin/settings');
        if (alive) setSettings(mergeSettings(data));
      } catch {
        toast('Could not load admin settings', 'error');
      }

      try {
        const data = await api.get('/subscriptions/multigym-config');
        if (alive && (data?.pro || data?.max)) setMultigym(data);
      } catch {
        toast('Could not load Multi-Gym pricing', 'error');
      }

      try {
        const res: any = await api.get('/users?role=super_admin&limit=50');
        const arr = Array.isArray(res) ? res : res?.data ?? res?.users ?? [];
        if (alive) setAdmins(arr.map(mapAdminUser).filter((u: AdminUser) => u.isActive));
      } catch {
        if (alive) setAdmins([]);
        toast('Could not load admin users', 'error');
      } finally {
        if (alive) setLoadingAdmins(false);
      }
    };

    load();
    return () => { alive = false; };
  }, [toast]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const saved = await api.put('/admin/settings', settings);
      setSettings(mergeSettings(saved));
      toast('Settings saved successfully');
    } catch {
      toast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveMultigym = async () => {
    setSavingMg(true);
    try {
      const saved = await api.put('/subscriptions/multigym-config', multigym);
      if (saved?.pro || saved?.max) setMultigym(saved);
      toast('Multi-Gym pricing updated');
    } catch {
      toast('Failed to save pricing', 'error');
    } finally {
      setSavingMg(false);
    }
  };

  const toggleFlag = (key: keyof Settings['flags']) => {
    setSettings((s) => ({ ...s, flags: { ...s.flags, [key]: !s.flags[key] } }));
  };

  const addAdmin = async () => {
    if (!newAdmin.email.trim() || !newAdmin.password.trim()) return;
    setAddingAdmin(true);
    try {
      const created = await api.post('/users/admins', newAdmin);
      setAdmins((prev) => [...prev, mapAdminUser(created)].filter((u) => u.isActive));
      toast('Admin user added');
      setNewAdmin({ name: '', email: '', password: '' });
      setShowAddAdmin(false);
    } catch (err: any) {
      toast(err?.message || 'Failed to add admin user', 'error');
    } finally {
      setAddingAdmin(false);
    }
  };

  const removeAdmin = async (admin: AdminUser) => {
    try {
      await api.post(`/users/${admin.id}/suspend`);
      setAdmins((prev) => prev.filter((x) => x.id !== admin.id));
      toast('Admin user deactivated', 'info');
    } catch {
      toast('Failed to deactivate admin user', 'error');
    }
  };

  const inputStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 14, width: '100%' };

  return (
    <Shell title="Settings">
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 mb-6">
        <div className="glass p-6">
          <h3 className="serif text-lg mb-4">Commission Rates</h3>
          <div className="space-y-3">
            {([['standard', 'Standard Rate'], ['premium', 'Premium Rate'], ['corporate', 'Corporate Rate']] as const).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <span className="text-[13px]" style={{ color: 'var(--t)' }}>{label}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0} max={100}
                    style={{ ...inputStyle, width: 70, textAlign: 'center' }}
                    value={settings.commission[key]}
                    onChange={(e) => setSettings((s) => ({ ...s, commission: { ...s.commission, [key]: Number(e.target.value) } }))}
                  />
                  <span className="text-[13px] font-semibold text-white">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass p-6">
          <h3 className="serif text-lg mb-4">Settlement Configuration</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <span className="text-[13px]" style={{ color: 'var(--t)' }}>Settlement Cycle</span>
              <select
                style={{ ...inputStyle, width: 140 }}
                value={settings.settlements.cycle}
                onChange={(e) => setSettings((s) => ({ ...s, settlements: { ...s.settlements, cycle: e.target.value } }))}
              >
                <option>Weekly</option><option>Bi-weekly</option><option>Monthly</option>
              </select>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <span className="text-[13px]" style={{ color: 'var(--t)' }}>Min Payout (Rs)</span>
              <input
                type="number"
                style={{ ...inputStyle, width: 120, textAlign: 'right' }}
                value={settings.settlements.minPayout}
                onChange={(e) => setSettings((s) => ({ ...s, settlements: { ...s.settlements, minPayout: Number(e.target.value) } }))}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <span className="text-[13px]" style={{ color: 'var(--t)' }}>Processing Window (days)</span>
              <input
                type="number"
                style={{ ...inputStyle, width: 80, textAlign: 'right' }}
                value={settings.settlements.processingWindow}
                onChange={(e) => setSettings((s) => ({ ...s, settlements: { ...s.settlements, processingWindow: Number(e.target.value) } }))}
              />
            </div>
          </div>
        </div>

        <div className="glass p-6">
          <h3 className="serif text-lg mb-4">Feature Flags</h3>
          <div className="space-y-3">
            {(Object.entries(settings.flags) as [keyof Settings['flags'], boolean][]).map(([key, enabled]) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <span className="text-[13px]" style={{ color: 'var(--t)' }}>
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                </span>
                <button
                  onClick={() => toggleFlag(key)}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative',
                    background: enabled ? 'var(--accent)' : 'var(--border)', transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 3, left: enabled ? 22 : 3, width: 18, height: 18,
                    borderRadius: '50%', background: enabled ? '#000' : '#666', transition: 'left 0.2s',
                  }} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="glass p-6">
          <h3 className="serif text-lg mb-1">Multi-Gym Pricing</h3>
          <p className="text-xs mb-4" style={{ color: 'var(--t2)' }}>Admin controls Pro and Max plan pricing. Individual gym plans are set by gym owners.</p>

          <div className="space-y-4">
            <div className="p-3 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="accent-pill text-xs">PRO</span>
                <span className="text-xs" style={{ color: 'var(--t2)' }}>Up to 5 distinct gyms</span>
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="Plan name" style={{ ...inputStyle, flex: 1 }}
                  value={multigym.pro.name}
                  onChange={(e) => setMultigym((m) => ({ ...m, pro: { ...m.pro, name: e.target.value } }))} />
                <div className="flex items-center gap-1" style={{ minWidth: 100, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                  <span style={{ color: 'var(--t3)', fontSize: 13 }}>Rs</span>
                  <input type="number" min={0} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 14, width: 70 }}
                    value={multigym.pro.basePrice}
                    onChange={(e) => setMultigym((m) => ({ ...m, pro: { ...m.pro, basePrice: Number(e.target.value) } }))} />
                  <span style={{ color: 'var(--t3)', fontSize: 11 }}>/mo</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ background: 'rgba(255,160,0,0.15)', color: '#ffa500', border: '1px solid rgba(255,160,0,0.4)', borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 700 }}>MAX</span>
                <span className="text-xs" style={{ color: 'var(--t2)' }}>Unlimited gyms</span>
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="Plan name" style={{ ...inputStyle, flex: 1 }}
                  value={multigym.max.name}
                  onChange={(e) => setMultigym((m) => ({ ...m, max: { ...m.max, name: e.target.value } }))} />
                <div className="flex items-center gap-1" style={{ minWidth: 100, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                  <span style={{ color: 'var(--t3)', fontSize: 13 }}>Rs</span>
                  <input type="number" min={0} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 14, width: 70 }}
                    value={multigym.max.basePrice}
                    onChange={(e) => setMultigym((m) => ({ ...m, max: { ...m.max, basePrice: Number(e.target.value) } }))} />
                  <span style={{ color: 'var(--t3)', fontSize: 11 }}>/mo</span>
                </div>
              </div>
            </div>

            <button className="btn btn-primary text-sm flex items-center gap-2" onClick={saveMultigym} disabled={savingMg}>
              <Save size={13} /> {savingMg ? 'Saving...' : 'Save Pricing'}
            </button>
          </div>
        </div>

        <div className="flex items-start">
          <button className="btn btn-primary flex items-center gap-2 mt-4" onClick={saveSettings} disabled={saving}>
            <Save size={15} /> {saving ? 'Saving...' : 'Save All Settings'}
          </button>
        </div>
      </div>

      <div className="glass p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="serif text-lg">Admin Users</h3>
          <button className="btn btn-primary text-sm flex items-center gap-1" onClick={() => setShowAddAdmin(true)}>
            <Plus size={14} /> Add Admin
          </button>
        </div>
        {loadingAdmins ? (
          <div className="space-y-2">{[1,2].map((i) => <div key={i} className="animate-pulse h-10 rounded" style={{ background: 'var(--surface)' }} />)}</div>
        ) : admins.length === 0 ? (
          <div className="text-sm" style={{ color: 'var(--t2)' }}>No active admin users returned by the API.</div>
        ) : (
          <table className="glass-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last Updated</th><th></th></tr></thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id}>
                  <td className="font-semibold text-white">{a.name}</td>
                  <td>{a.email}</td>
                  <td><span className="accent-pill">{a.role}</span></td>
                  <td style={{ color: 'var(--t2)' }}>{a.lastLogin ? new Date(a.lastLogin).toLocaleString() : '--'}</td>
                  <td>
                    <button className="btn btn-ghost text-xs" style={{ color: 'rgba(255,100,100,0.7)' }} onClick={() => removeAdmin(a)}>
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAddAdmin && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}} onClick={() => setShowAddAdmin(false)}>
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:20,padding:28,width:440,maxWidth:'90vw'}} onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 style={{fontFamily:'var(--serif)',fontSize:20,color:'#fff'}}>Add Admin User</h3>
              <button className="btn btn-ghost" onClick={() => setShowAddAdmin(false)}><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="kicker block mb-1">Name</label>
                <input className="glass-input w-full" value={newAdmin.name} onChange={(e) => setNewAdmin((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" />
              </div>
              <div>
                <label className="kicker block mb-1">Email</label>
                <input className="glass-input w-full" type="email" value={newAdmin.email} onChange={(e) => setNewAdmin((f) => ({ ...f, email: e.target.value }))} placeholder="admin@bookmyfit.in" />
              </div>
              <div>
                <label className="kicker block mb-1">Initial Password</label>
                <input className="glass-input w-full" type="password" value={newAdmin.password} onChange={(e) => setNewAdmin((f) => ({ ...f, password: e.target.value }))} placeholder="Min. 6 characters" />
              </div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:20}}>
              <button className="btn btn-ghost flex-1" onClick={() => setShowAddAdmin(false)}>Cancel</button>
              <button className="btn btn-primary flex-1" onClick={addAdmin} disabled={addingAdmin || !newAdmin.email.trim() || newAdmin.password.length < 6}>
                {addingAdmin ? 'Adding...' : 'Add Admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
