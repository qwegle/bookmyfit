'use client';
import { useEffect, useState } from 'react';
import Shell from '../../components/Shell';
import { Plus, X, Pencil, Trash2 } from 'lucide-react';
import { api, getPartnerId } from '../../lib/api';
import { useToast } from '../../components/Toast';

type Service = {
  id: string;
  name: string;
  description?: string;
  duration?: number;
  durationMinutes?: number;
  price?: number;
  category?: string;
  isActive?: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  reviewNote?: string | null;
};

const CATEGORIES = ['yoga', 'physio', 'nutrition', 'meditation', 'spa', 'training'];

const EMPTY_FORM = { name: '', description: '', duration: '', price: '', category: 'yoga' };

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Service | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const partnerId = getPartnerId();

  const load = async () => {
    if (!partnerId) return;
    setLoading(true);
    try {
      const data = await api.get<Service[]>(`/wellness/${partnerId}/services`);
      setServices(data ?? []);
    } catch {
      toast('Failed to load services', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (s: Service) => {
    setEditTarget(s);
    setForm({
      name: s.name,
      description: s.description || '',
      duration: String(s.durationMinutes || s.duration || ''),
      price: String(s.price || ''),
      category: s.category || 'yoga',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerId) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        durationMinutes: Number(form.duration),
        price: Number(form.price),
        category: form.category,
      };
      if (editTarget) {
        await api.put(`/wellness/${partnerId}/services/${editTarget.id}`, payload);
        toast('Service updated and sent for admin review');
      } else {
        await api.post(`/wellness/${partnerId}/services`, payload);
        toast('Service added and sent for admin review');
      }
      setShowModal(false);
      load();
    } catch (err: any) {
      toast(err.message || 'Failed to save service', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!partnerId || !confirm('Delete this service?')) return;
    try {
      await api.del(`/wellness/${partnerId}/services/${id}`);
      toast('Service deleted');
      setServices(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      toast(err.message || 'Failed to delete', 'error');
    }
  };

  const categoryColor: Record<string, string> = {
    yoga: '#A78BFA',
    physio: '#60A5FA',
    nutrition: '#34D399',
    meditation: '#F9A8D4',
    spa: '#FCD34D',
    training: '#3DFF54',
  };
  const approvalColor: Record<string, string> = {
    approved: '#3DFF54',
    pending: '#FCD34D',
    rejected: '#FF6060',
  };

  return (
    <Shell title="Services">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm" style={{ color: 'var(--t2)' }}>{services.length} service{services.length !== 1 ? 's' : ''} listed</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary">
          <Plus size={14} /> Add Service
        </button>
      </div>

      {loading && <p style={{ color: 'var(--t2)', fontSize: 13 }}>Loading services…</p>}

      {!loading && services.length === 0 && (
        <div className="glass p-12 text-center">
          <p style={{ color: 'var(--t2)' }}>No services yet. Add your first service to get started.</p>
          <button onClick={openAdd} className="btn btn-primary mt-4">
            <Plus size={14} /> Add Service
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {services.map((s) => (
          <div key={s.id} className="card p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-white" style={{ fontSize: 15 }}>{s.name}</div>
                {s.category && (
                  <span
                    className="text-xs font-bold uppercase tracking-wider mt-1 inline-block"
                    style={{ color: categoryColor[s.category] || 'var(--accent)', letterSpacing: 1 }}>
                    {s.category}
                  </span>
                )}
                <span
                  className="text-xs font-bold uppercase tracking-wider mt-2 block"
                  style={{ color: approvalColor[s.approvalStatus || 'approved'] || 'var(--accent)', letterSpacing: 1 }}>
                  {s.approvalStatus || 'approved'}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(s)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition"
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <Pencil size={13} style={{ color: 'var(--t2)' }} />
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition"
                  style={{ background: 'rgba(255,60,60,0.08)' }}>
                  <Trash2 size={13} style={{ color: '#FF6060' }} />
                </button>
              </div>
            </div>

            {s.description && (
              <p style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5 }}>{s.description}</p>
            )}
            {s.reviewNote && (
              <p style={{ fontSize: 12, color: '#FF9F9F', lineHeight: 1.5 }}>{s.reviewNote}</p>
            )}

            <div className="flex items-center gap-4 mt-auto pt-2" style={{ borderTop: '1px solid var(--border)' }}>
              {(s.durationMinutes ?? s.duration) != null && (
                <div style={{ fontSize: 12, color: 'var(--t2)' }}>
                  <span className="font-semibold text-white">{s.durationMinutes ?? s.duration}</span> min
                </div>
              )}
              {s.price != null && (
                <div style={{ fontSize: 12, color: 'var(--t2)' }}>
                  <span className="font-semibold text-white">₹{s.price}</span>
                </div>
              )}
              <div className="ml-auto">
                <span className={s.isActive !== false && (s.approvalStatus || 'approved') === 'approved' ? 'badge-active' : 'badge-pending'}>
                  {s.isActive !== false && (s.approvalStatus || 'approved') === 'approved' ? 'visible' : 'not visible'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="glass p-8 w-full max-w-lg relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.06)' }}>
              <X size={14} />
            </button>
            <h2 className="serif text-xl font-bold mb-6">{editTarget ? 'Edit Service' : 'Add Service'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--t2)' }}>Service Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Hatha Yoga Class"
                  className="glass-input w-full"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--t2)' }}>Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the service…"
                  className="glass-input w-full"
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--t2)' }}>Duration (min)</label>
                  <input
                    type="number"
                    value={form.duration}
                    onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                    placeholder="60"
                    className="glass-input w-full"
                    min={1}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--t2)' }}>Price (₹)</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="500"
                    className="glass-input w-full"
                    min={0}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--t2)' }}>Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="glass-input w-full">
                  {CATEGORIES.map(c => (
                    <option key={c} value={c} style={{ background: '#111' }}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost flex-1 justify-center">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary flex-1 justify-center" disabled={saving}>
                  {saving ? 'Saving…' : editTarget ? 'Update Service' : 'Add Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}
