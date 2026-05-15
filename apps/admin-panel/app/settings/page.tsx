'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '../../components/Shell';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { Building2, ListChecks, Plus, Sparkles, Users, X } from 'lucide-react';

type PassCommission = { mode?: 'percent' | 'fixed'; value?: number };
interface AdminUser { id: string; name: string; email: string; role: string; lastLogin?: string; isActive?: boolean; }

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

function asArray(value: any) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.partners)) return value.partners;
  return [];
}

function formatMoney(value: any) {
  if (value == null || value === '') return 'Unavailable';
  const amount = Math.round(Number(value) || 0);
  return `Rs ${amount.toLocaleString('en-IN')}`;
}

function formatCommission(value: PassCommission | undefined) {
  const amount = Math.max(0, Number(value?.value) || 0);
  if (!amount) return '0';
  return value?.mode === 'fixed' ? formatMoney(amount) : `${amount}%`;
}

function avg(values: number[]) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return null;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<any>(null);
  const [gymStats, setGymStats] = useState({ total: 0, avgCommission: null as number | null });
  const [wellnessStats, setWellnessStats] = useState({ total: 0, avgCommission: null as number | null });
  const [availability, setAvailability] = useState({ plans: false, gyms: false, wellness: false });
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '' });

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      try {
        const [planRes, gymRes, wellnessRes, adminRes] = await Promise.all([
          api.get('/subscriptions/plans').catch(() => null),
          api.get('/gyms?limit=200').catch(() => null),
          api.get('/wellness/admin/partners').catch(() => null),
          api.get('/users?role=super_admin&limit=50').catch(() => null),
        ]);

        if (!alive) return;

        setPlans(planRes || null);
        setAvailability({ plans: Boolean(planRes), gyms: Boolean(gymRes), wellness: Boolean(wellnessRes) });

        const gyms = asArray(gymRes);
        setGymStats({
          total: Number((gymRes as any)?.total || gyms.length || 0),
          avgCommission: avg(gyms.map((gym: any) => Number(gym.commissionRate))),
        });

        const wellnessPartners = asArray(wellnessRes);
        setWellnessStats({
          total: Number((wellnessRes as any)?.total || wellnessPartners.length || 0),
          avgCommission: avg(wellnessPartners.map((partner: any) => Number(partner.commissionRate))),
        });

        const adminArr = asArray(adminRes);
        setAdmins(adminArr.map(mapAdminUser).filter((user: AdminUser) => user.isActive));
      } catch {
        toast('Could not load admin settings', 'error');
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => { alive = false; };
  }, [toast]);

  const addAdmin = async () => {
    if (!newAdmin.email.trim() || !newAdmin.password.trim()) return;
    setAddingAdmin(true);
    try {
      const created = await api.post('/users/admins', newAdmin);
      setAdmins((prev) => [...prev, mapAdminUser(created)].filter((user) => user.isActive));
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
      setAdmins((prev) => prev.filter((item) => item.id !== admin.id));
      toast('Admin user deactivated', 'info');
    } catch {
      toast('Failed to deactivate admin user', 'error');
    }
  };

  const revenueCards = [
    {
      label: 'Day Pass Checkout',
      value: loading ? '...' : !availability.plans ? 'Unavailable' : `${formatMoney(plans?.day_pass?.basePrice)} + ${formatCommission(plans?.day_pass?.commission)}`,
      sub: 'Plan Management',
      href: '/plans',
      icon: ListChecks,
    },
    {
      label: 'Same Gym Checkout',
      value: loading ? '...' : !availability.plans ? 'Unavailable' : formatCommission(plans?.same_gym?.commission),
      sub: 'Plan Management',
      href: '/plans',
      icon: ListChecks,
    },
    {
      label: 'Multi Gym Pass',
      value: loading ? '...' : !availability.plans ? 'Unavailable' : `${formatMoney(plans?.multi_gym?.basePrice)} / mo`,
      sub: 'Plan Management',
      href: '/plans',
      icon: ListChecks,
    },
    {
      label: 'Gym Revenue Share',
      value: loading ? '...' : !availability.gyms ? 'Unavailable' : gymStats.avgCommission == null ? 'Not set' : `${gymStats.avgCommission.toFixed(1)}% avg`,
      sub: availability.gyms ? `${gymStats.total} gyms` : 'Gyms API',
      href: '/tiers',
      icon: Building2,
    },
    {
      label: 'Wellness Commission',
      value: loading ? '...' : !availability.wellness ? 'Unavailable' : wellnessStats.avgCommission == null ? 'Not set' : `${wellnessStats.avgCommission.toFixed(1)}% avg`,
      sub: availability.wellness ? `${wellnessStats.total} partners` : 'Wellness API',
      href: '/wellness',
      icon: Sparkles,
    },
  ];

  return (
    <Shell title="Settings">
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-6">
        {revenueCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} href={card.href} className="glass p-5 block transition hover:bg-white/5">
              <div className="flex items-center justify-between mb-4">
                <Icon size={18} style={{ color: 'var(--accent)' }} />
                <span className="accent-pill text-[10px]">{card.sub}</span>
              </div>
              <div className="text-2xl font-bold mb-1">{card.value}</div>
              <div className="text-xs" style={{ color: 'var(--t2)' }}>{card.label}</div>
            </Link>
          );
        })}
      </div>

      <div className="glass p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="serif text-lg mb-2">Active Revenue Controls</h3>
            <p className="text-sm max-w-3xl" style={{ color: 'var(--t2)' }}>
              Checkout add-on commission is managed from Plan Management. Per-gym revenue share is managed from Tier Management or Gym Management. Wellness commission is managed per wellness partner.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <Link href="/plans" className="btn btn-primary text-sm">Plan Management</Link>
            <Link href="/tiers" className="btn btn-ghost text-sm">Tier Management</Link>
            <Link href="/wellness" className="btn btn-ghost text-sm">Wellness</Link>
          </div>
        </div>
      </div>

      <div className="glass p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users size={18} style={{ color: 'var(--accent)' }} />
            <h3 className="serif text-lg">Admin Users</h3>
          </div>
          <button className="btn btn-primary text-sm flex items-center gap-1" onClick={() => setShowAddAdmin(true)}>
            <Plus size={14} /> Add Admin
          </button>
        </div>
        {loading ? (
          <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="animate-pulse h-10 rounded" style={{ background: 'var(--surface)' }} />)}</div>
        ) : admins.length === 0 ? (
          <div className="text-sm" style={{ color: 'var(--t2)' }}>No active admin users returned by the API.</div>
        ) : (
          <table className="glass-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last Updated</th><th></th></tr></thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id}>
                  <td className="font-semibold text-white">{admin.name}</td>
                  <td>{admin.email}</td>
                  <td><span className="accent-pill">{admin.role}</span></td>
                  <td style={{ color: 'var(--t2)' }}>{admin.lastLogin ? new Date(admin.lastLogin).toLocaleString() : '--'}</td>
                  <td>
                    <button className="btn btn-ghost text-xs" style={{ color: 'rgba(255,100,100,0.7)' }} onClick={() => removeAdmin(admin)}>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowAddAdmin(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 28, width: 440, maxWidth: '90vw' }} onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 20, color: '#fff' }}>Add Admin User</h3>
              <button className="btn btn-ghost" onClick={() => setShowAddAdmin(false)}><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="kicker block mb-1">Name</label>
                <input className="glass-input w-full" value={newAdmin.name} onChange={(e) => setNewAdmin((form) => ({ ...form, name: e.target.value }))} placeholder="Full name" />
              </div>
              <div>
                <label className="kicker block mb-1">Email</label>
                <input className="glass-input w-full" type="email" value={newAdmin.email} onChange={(e) => setNewAdmin((form) => ({ ...form, email: e.target.value }))} placeholder="admin@bookmyfit.in" />
              </div>
              <div>
                <label className="kicker block mb-1">Initial Password</label>
                <input className="glass-input w-full" type="password" value={newAdmin.password} onChange={(e) => setNewAdmin((form) => ({ ...form, password: e.target.value }))} placeholder="Min. 6 characters" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
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
