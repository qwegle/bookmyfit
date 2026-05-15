'use client';
import { useCallback, useEffect, useState } from 'react';
import Shell from '../../components/Shell';
import { AlertTriangle, CheckCircle, Clock, Edit3, Eye, PauseCircle, Power, PowerOff, Star, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import Pagination from '../../components/Pagination';

type Gym = {
  id: string;
  name: string;
  city: string;
  area?: string;
  address?: string;
  description?: string;
  pinCode?: string;
  contactPhone?: string;
  contactEmail?: string;
  phone?: string;
  email?: string;
  website?: string;
  tier: string;
  status: string;
  rating: number;
  lat?: number;
  lng?: number;
  ratePerDay?: number;
  dayPassPrice?: number | null;
  capacity?: number;
};

const STATUS_FILTERS = ['all', 'active', 'pending', 'suspended', 'inactive', 'rejected'] as const;
const TIERS = [
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' },
  { value: 'corporate_exclusive', label: 'Corporate Exclusive' },
];

function titleCase(value?: string) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) || '-';
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    active: 'badge-active',
    pending: 'badge-pending',
    suspended: 'badge-danger',
    inactive: 'badge-danger',
    rejected: 'badge-danger',
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

function fieldValue(value: any) {
  return value === null || value === undefined ? '' : String(value);
}

export default function GymsPage() {
  const { toast } = useToast();
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [editingGym, setEditingGym] = useState<Gym | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = statusFilter === 'all' ? '' : `&status=${statusFilter}`;
      const res = await api.get<any>(`/gyms/admin/list?page=${page}&limit=${limit}${q ? `&search=${encodeURIComponent(q)}` : ''}${status}`);
      const rows: Gym[] = Array.isArray(res) ? res : res?.data ?? [];
      setGyms(rows);
      setTotal(res?.total ?? rows.length);
      setPages(res?.pages ?? 1);
    } catch {
      setGyms([]);
      setTotal(0);
      setPages(1);
      setError('Failed to load gyms. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, q, statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [q, statusFilter]);

  const openEdit = (gym: Gym) => {
    setEditingGym(gym);
    setForm({
      name: fieldValue(gym.name),
      description: fieldValue(gym.description),
      city: fieldValue(gym.city),
      area: fieldValue(gym.area),
      address: fieldValue(gym.address),
      pinCode: fieldValue(gym.pinCode),
      contactPhone: fieldValue(gym.contactPhone || gym.phone),
      contactEmail: fieldValue(gym.contactEmail || gym.email),
      website: fieldValue(gym.website),
      tier: fieldValue(gym.tier || 'standard'),
      status: fieldValue(gym.status || 'pending'),
      lat: fieldValue(gym.lat),
      lng: fieldValue(gym.lng),
      ratePerDay: fieldValue(gym.ratePerDay),
      dayPassPrice: fieldValue(gym.dayPassPrice),
      capacity: fieldValue(gym.capacity),
    });
  };

  const patchLocal = (id: string, patch: Partial<Gym>) => {
    setGyms((prev) => prev.map((g) => g.id === id ? { ...g, ...patch } : g));
  };

  const changeStatus = async (gym: Gym, action: 'approve' | 'activate' | 'suspend' | 'deactivate') => {
    try {
      const updated = await api.post<Gym>(`/gyms/${gym.id}/${action}`);
      patchLocal(gym.id, { status: updated?.status || (action === 'deactivate' ? 'inactive' : action === 'suspend' ? 'suspended' : 'active') });
      toast(action === 'deactivate' ? 'Gym deactivated' : action === 'suspend' ? 'Gym suspended' : 'Gym activated');
    } catch (e: any) {
      toast(e.message || 'Status update failed', 'error');
    }
  };

  const saveEdit = async () => {
    if (!editingGym) return;
    setSaving(true);
    try {
      const body: any = {
        name: form.name,
        description: form.description,
        city: form.city,
        area: form.area,
        address: form.address,
        pinCode: form.pinCode,
        contactPhone: form.contactPhone,
        contactEmail: form.contactEmail,
        website: form.website,
        tier: form.tier,
        status: form.status,
        lat: form.lat,
        lng: form.lng,
        ratePerDay: form.ratePerDay,
        dayPassPrice: form.dayPassPrice,
        capacity: form.capacity,
      };
      const updated = await api.put<Gym>(`/gyms/${editingGym.id}`, body);
      patchLocal(editingGym.id, updated);
      setEditingGym(null);
      toast('Gym details updated');
    } catch (e: any) {
      toast(e.message || 'Failed to save gym details', 'error');
    } finally {
      setSaving(false);
    }
  };

  const stats = {
    active: gyms.filter((g) => g.status === 'active').length,
    pending: gyms.filter((g) => g.status === 'pending').length,
    suspended: gyms.filter((g) => g.status === 'suspended').length,
    inactive: gyms.filter((g) => g.status === 'inactive').length,
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
          { label: 'Inactive', value: stats.inactive, icon: PowerOff, color: '#FF3C3C' },
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
        <input value={q} onChange={(e) => setQ(e.target.value)} className="glass-input flex-1" placeholder="Search gyms by name or city..." />
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
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

      <div className="glass" style={{ position: 'relative', overflowX: 'auto', overflowY: 'visible' }}>
        <table className="glass-table">
          <thead>
            <tr>
              <th>Gym Name</th><th>Location</th><th>Tier</th><th>Status</th>
              <th>Coordinates</th><th>Rating</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : gyms.length === 0
                ? <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--t2)', padding: '40px 0' }}>No gyms found</td></tr>
                : gyms.map((g) => (
                  <tr key={g.id}>
                    <td className="font-semibold" style={{ color: '#fff' }}>{g.name}</td>
                    <td>{g.city}{g.area ? `, ${g.area}` : ''}</td>
                    <td>{titleCase(g.tier)}</td>
                    <td><StatusBadge status={g.status} /></td>
                    <td style={{ color: g.lat && g.lng ? 'var(--t2)' : '#FFB400', fontSize: 12 }}>
                      {g.lat && g.lng ? `${Number(g.lat).toFixed(4)}, ${Number(g.lng).toFixed(4)}` : 'Needs location'}
                    </td>
                    <td><Star size={12} color="#FFB400" fill="#FFB400" style={{ display:'inline', verticalAlign:'middle', marginRight:3 }} />{g.rating ?? '--'}</td>
                    <td>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setSelectedGym(g)} className="btn btn-ghost text-xs" style={{ padding: '4px 10px', fontSize: 11 }}><Eye size={12} /> View</button>
                        <button onClick={() => openEdit(g)} className="btn btn-ghost text-xs" style={{ padding: '4px 10px', fontSize: 11 }}><Edit3 size={12} /> Edit</button>
                        {g.status === 'pending' && <button onClick={() => changeStatus(g, 'approve')} className="btn btn-primary text-xs" style={{ padding: '4px 10px', fontSize: 11 }}>Approve</button>}
                        {g.status !== 'active' && <button onClick={() => changeStatus(g, 'activate')} className="btn text-xs" style={{ padding: '4px 10px', fontSize: 11, background: 'rgba(61,255,84,0.15)', color: 'var(--accent)', border: '1px solid rgba(61,255,84,0.3)' }}><Power size={12} /> Activate</button>}
                        {g.status === 'active' && <button onClick={() => changeStatus(g, 'suspend')} className="btn text-xs" style={{ padding: '4px 10px', fontSize: 11, background: 'rgba(255,180,0,0.15)', color: '#FFB400', border: '1px solid rgba(255,180,0,0.3)' }}>Suspend</button>}
                        {g.status !== 'inactive' && <button onClick={() => changeStatus(g, 'deactivate')} className="btn text-xs" style={{ padding: '4px 10px', fontSize: 11, background: 'rgba(255,60,60,0.15)', color: '#FF3C3C', border: '1px solid rgba(255,60,60,0.3)' }}>Deactivate</button>}
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={pages} total={total} limit={limit} onPage={setPage} onLimit={(l) => { setLimit(l); setPage(1); }} />

      {selectedGym && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.72)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <div className="glass" style={{ width: 'min(680px, 96vw)', maxHeight: '86vh', overflowY: 'auto', padding: 28, borderRadius: 18 }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="serif text-xl">{selectedGym.name}</h3>
              <button onClick={() => setSelectedGym(null)} className="btn btn-ghost text-xs"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                ['Status', selectedGym.status],
                ['Tier', titleCase(selectedGym.tier)],
                ['City', selectedGym.city],
                ['Area', selectedGym.area || '-'],
                ['Address', selectedGym.address || '-'],
                ['Phone', selectedGym.contactPhone || selectedGym.phone || '-'],
                ['Email', selectedGym.contactEmail || selectedGym.email || '-'],
                ['Website', selectedGym.website || '-'],
                ['Coordinates', selectedGym.lat && selectedGym.lng ? `${selectedGym.lat}, ${selectedGym.lng}` : 'Not set'],
                ['Multi-gym visit payout', selectedGym.ratePerDay ? `Rs ${selectedGym.ratePerDay}` : '-'],
              ].map(([label, value]) => (
                <div key={label} className="card p-3">
                  <div className="kicker mb-1" style={{ color: 'var(--t3)' }}>{label}</div>
                  <div style={{ color: 'var(--t)' }}>{value}</div>
                </div>
              ))}
            </div>
            {selectedGym.description && <p className="mt-4 text-sm" style={{ color: 'var(--t2)' }}>{selectedGym.description}</p>}
          </div>
        </div>
      )}

      {editingGym && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.72)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <div className="glass" style={{ width: 'min(860px, 96vw)', maxHeight: '86vh', overflowY: 'auto', padding: 28, borderRadius: 18 }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="serif text-xl">Edit Gym</h3>
              <button onClick={() => setEditingGym(null)} className="btn btn-ghost text-xs"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['name', 'Name'], ['city', 'City'], ['area', 'Area'], ['pinCode', 'Pin Code'],
                ['contactPhone', 'Phone'], ['contactEmail', 'Email'], ['website', 'Website'],
                ['lat', 'Latitude'], ['lng', 'Longitude'], ['ratePerDay', 'Multi-gym Visit Payout'], ['dayPassPrice', 'Day Pass Price'], ['capacity', 'Capacity'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--t2)' }}>{label}</label>
                  <input className="glass-input w-full" value={form[key] || ''} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--t2)' }}>Tier</label>
                <select className="glass-input w-full" value={form.tier || 'standard'} onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))}>
                  {TIERS.map((tier) => <option key={tier.value} value={tier.value}>{tier.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--t2)' }}>Status</label>
                <select className="glass-input w-full" value={form.status || 'pending'} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  {STATUS_FILTERS.filter((s) => s !== 'all').map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--t2)' }}>Address</label>
                <input className="glass-input w-full" value={form.address || ''} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--t2)' }}>Description</label>
                <textarea className="glass-input w-full h-20 resize-none" value={form.description || ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditingGym(null)} className="btn btn-ghost text-sm">Cancel</button>
              <button onClick={saveEdit} disabled={saving} className="btn btn-primary text-sm">{saving ? 'Saving...' : 'Save Gym'}</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
