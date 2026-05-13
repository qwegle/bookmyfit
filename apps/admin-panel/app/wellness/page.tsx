'use client';
import { useState, useEffect } from 'react';
import Shell from '../../components/Shell';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { Plus, Edit3, Trash2, Check, X, MapPin, Star, Clock, Tag, Building2, Image as ImageIcon, Percent, Activity } from 'lucide-react';

const SERVICE_CATEGORIES = ['Massage', 'Cupping', 'Physio', 'Spa', 'Nutrition', 'Recovery', 'Other'];
const SERVICE_TYPES = ['Spa', 'Home', 'Physio', 'Massage', 'Yoga', 'Nutrition'];

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  padding: 24,
};

const input: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
  color: '#fff', padding: '10px 14px',
  fontFamily: 'DM Sans, sans-serif', fontSize: 14, outline: 'none',
  boxSizing: 'border-box',
};

const btn = (variant: 'green' | 'ghost' | 'red' = 'ghost'): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
  fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 13,
  ...(variant === 'green' ? { background: '#3DFF54', color: '#060606' }
    : variant === 'red' ? { background: 'rgba(255,60,60,0.15)', color: '#ff6b6b', border: '1px solid rgba(255,60,60,0.2)' }
    : { background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }),
});

const pill = (color: string): React.CSSProperties => ({
  background: `${color}22`, border: `1px solid ${color}44`,
  borderRadius: 20, padding: '3px 10px', fontSize: 11,
  fontWeight: 700, color, letterSpacing: 0.5,
  display: 'inline-flex', alignItems: 'center',
});

type Partner = {
  id: string; name: string; serviceType: string; city: string; area: string;
  address: string; rating: number; reviewCount: number; status: string;
  discountPercent: number; distanceLabel: string; photos: string[]; commissionRate: number;
};
type Service = {
  id: string; name: string; category: string; price: number; originalPrice: number | null;
  durationMinutes: number; isActive: boolean; partnerId: string; imageUrl: string | null;
};

const defaultPartnerForm = { name: '', serviceType: 'Spa', city: '', area: '', address: '', status: 'active', discountPercent: '0', distanceLabel: '', commissionRate: '', photos: '' };
const defaultServiceForm = { name: '', category: 'Massage', price: '', originalPrice: '', durationMinutes: '60', partnerId: '', imageUrl: '', isActive: true };

export default function WellnessPage() {
  const [tab, setTab] = useState<'centres' | 'services'>('centres');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');

  // Partner form
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [partnerForm, setPartnerForm] = useState(defaultPartnerForm);

  // Service form
  const [showSvcForm, setShowSvcForm] = useState(false);
  const [editingSvc, setEditingSvc] = useState<Service | null>(null);
  const [svcForm, setSvcForm] = useState(defaultServiceForm);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/wellness/partners?page=1&limit=50').catch(() => null),
      api.get('/wellness/services/all').catch(() => null),
    ]).then(([partnersRes, servicesRes]) => {
      const pts = (partnersRes as any)?.data || partnersRes;
      const svcs = servicesRes;
      setPartners(Array.isArray(pts) ? pts as Partner[] : []);
      setServices(Array.isArray(svcs) ? svcs as Service[] : []);
    }).catch(() => flash('Could not load wellness data.', 'error')).finally(() => setLoading(false));
  }, []);

  const flash = (m: string, type: 'success' | 'error' = 'success') => {
    setMsg(m); setMsgType(type); setTimeout(() => setMsg(''), 3500);
  };

  // Partner CRUD
  const openAddPartner = () => {
    setEditingPartner(null);
    setPartnerForm(defaultPartnerForm);
    setShowPartnerForm(true);
  };
  const openEditPartner = (p: Partner) => {
    setEditingPartner(p);
    setPartnerForm({
      name: p.name, serviceType: p.serviceType, city: p.city, area: p.area,
      address: p.address || '', status: p.status,
      discountPercent: String(p.discountPercent || 0),
      distanceLabel: p.distanceLabel || '',
      commissionRate: String(p.commissionRate ?? ''),
      photos: (p.photos || []).join(', '),
    });
    setShowPartnerForm(true);
  };
  const savePartner = async () => {
    if (!partnerForm.name || !partnerForm.city) return flash('Please fill required fields', 'error');
    const body = {
      name: partnerForm.name,
      serviceType: partnerForm.serviceType,
      city: partnerForm.city,
      area: partnerForm.area,
      address: partnerForm.address || `${partnerForm.area}, ${partnerForm.city}`,
      status: partnerForm.status,
      discountPercent: Number(partnerForm.discountPercent) || 0,
      distanceLabel: partnerForm.distanceLabel,
      ...(partnerForm.commissionRate.trim() ? { commissionRate: Number(partnerForm.commissionRate) } : {}),
      photos: partnerForm.photos ? partnerForm.photos.split(',').map(s => s.trim()).filter(Boolean) : [],
      rating: editingPartner?.rating || 0,
      reviewCount: editingPartner?.reviewCount || 0,
      lat: 0, lng: 0,
    };
    try {
      if (editingPartner) {
        await api.put(`/wellness/partners/${editingPartner.id}`, body);
        setPartners(ps => ps.map(p => p.id === editingPartner.id ? { ...p, ...body } : p));
        flash('Spa centre updated!');
      } else {
        const created: any = await api.post('/wellness/partners', body);
        if (!created?.id) throw new Error('API did not return the created partner.');
        setPartners(ps => [...ps, created]);
        flash('Spa centre added!');
      }
    } catch (e: any) {
      flash(e?.message || 'Save failed. Please retry after checking your login session.', 'error');
      return;
    }
    setShowPartnerForm(false); setEditingPartner(null);
  };
  const deletePartner = async (id: string) => {
    try {
      await api.del(`/wellness/partners/${id}`);
      setPartners(ps => ps.filter(p => p.id !== id));
      setServices(ss => ss.filter(s => s.partnerId !== id));
      flash('Spa centre deleted');
    } catch {
      flash('Delete failed. Please retry after checking your login session.', 'error');
    }
  };

  // Service CRUD
  const openAddService = () => {
    setEditingSvc(null);
    setSvcForm({ ...defaultServiceForm, partnerId: selectedPartnerId });
    setShowSvcForm(true);
  };
  const openEditService = (svc: Service) => {
    setEditingSvc(svc);
    setSvcForm({
      name: svc.name, category: svc.category, price: String(svc.price),
      originalPrice: String(svc.originalPrice || ''), durationMinutes: String(svc.durationMinutes),
      partnerId: svc.partnerId, imageUrl: svc.imageUrl || '', isActive: svc.isActive,
    });
    setShowSvcForm(true);
  };
  const saveService = async () => {
    if (!svcForm.name || !svcForm.price) return flash('Please fill required fields', 'error');
    const body = {
      partnerId: svcForm.partnerId,
      name: svcForm.name,
      category: svcForm.category,
      price: Number(svcForm.price),
      originalPrice: Number(svcForm.originalPrice) || null,
      durationMinutes: Number(svcForm.durationMinutes),
      isActive: svcForm.isActive,
      imageUrl: svcForm.imageUrl || null,
    };
    try {
      if (editingSvc) {
        await api.put(`/wellness/services/${editingSvc.id}`, body);
        setServices(ss => ss.map(s => s.id === editingSvc.id ? { ...s, ...body } : s));
      } else {
        const created: any = await api.post('/wellness/services', body);
        if (!created?.id) throw new Error('API did not return the created service.');
        setServices(ss => [...ss, created]);
      }
      flash('Service saved!');
    } catch (e: any) {
      flash(e?.message || 'Service save failed. Please retry after checking your login session.', 'error');
      return;
    }
    setShowSvcForm(false); setEditingSvc(null);
  };
  const toggleService = async (id: string) => {
    const svc = services.find(s => s.id === id);
    if (!svc) return;
    const nextActive = !svc.isActive;
    try {
      await api.put(`/wellness/services/${id}`, { isActive: nextActive });
      setServices(ss => ss.map(s => s.id === id ? { ...s, isActive: nextActive } : s));
      flash(nextActive ? 'Service activated' : 'Service deactivated');
    } catch {
      flash('Status update failed. Please retry after checking your login session.', 'error');
    }
  };
  const deleteService = async (id: string) => {
    try {
      await api.del(`/wellness/services/${id}`);
      setServices(ss => ss.filter(s => s.id !== id));
      flash('Service deleted');
    } catch {
      flash('Delete failed. Please retry after checking your login session.', 'error');
    }
  };

  const catColor: Record<string, string> = { Massage: '#3DFF54', Cupping: '#9B5DE5', Physio: '#00AFFF', Spa: '#FFD93D', Nutrition: '#FF9F1C', Recovery: '#FF6B6B', Other: '#aaa' };
  const statusColor: Record<string, string> = { active: '#3DFF54', pending: '#FFD93D', inactive: '#ff6b6b' };

  const filteredServices = selectedPartnerId
    ? services.filter(s => s.partnerId === selectedPartnerId)
    : services;

  const label = (text: string): React.CSSProperties => ({
    display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 11,
    fontWeight: 700, letterSpacing: 0.5, marginBottom: 6, fontFamily: 'DM Sans, sans-serif',
  });

  return (
    <Shell title="Wellness Services">
      {/* Flash message */}
      {msg && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: msgType === 'success' ? '#3DFF54' : '#ff6b6b',
          color: '#060606', padding: '10px 20px', borderRadius: 10,
          fontWeight: 700, fontFamily: 'DM Sans, sans-serif', fontSize: 14,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>{msg}</div>
      )}

      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, color: '#fff', margin: 0, letterSpacing: -0.5 }}>Wellness Services</h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, margin: '4px 0 0', fontFamily: 'DM Sans, sans-serif' }}>
            Manage spa centres, services, pricing and visibility
          </p>
        </div>
        <button style={btn('green')} onClick={tab === 'centres' ? openAddPartner : openAddService}>
          <Plus size={16} />
          {tab === 'centres' ? 'Add Spa Centre' : 'Add Service'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['centres', 'services'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '9px 22px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 13,
              background: tab === t ? '#3DFF54' : 'rgba(255,255,255,0.07)',
              color: tab === t ? '#060606' : '#fff',
              transition: 'all 0.15s',
            }}
          >
            {t === 'centres' ? `Spa Centres (${partners.length})` : `Services (${services.length})`}
          </button>
        ))}
      </div>

      {/* ===== SPA CENTRES TAB ===== */}
      {tab === 'centres' && (
        <>
          {/* Add/Edit Partner Form */}
          {showPartnerForm && (
            <div style={{ ...card, marginBottom: 20, borderColor: 'rgba(61,255,84,0.2)' }}>
              <h3 style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, color: '#fff', margin: '0 0 20px', fontSize: 17 }}>
                {editingPartner ? 'Edit Spa Centre' : 'New Spa Centre'}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={label('NAME *')}>NAME *</label>
                  <input style={input} placeholder="e.g. Serenity Spa & Wellness" value={partnerForm.name} onChange={e => setPartnerForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label style={label('SERVICE TYPE')}>SERVICE TYPE</label>
                  <select style={{ ...input, cursor: 'pointer' }} value={partnerForm.serviceType} onChange={e => setPartnerForm(f => ({ ...f, serviceType: e.target.value }))}>
                    {SERVICE_TYPES.map(t => <option key={t} value={t} style={{ background: '#111' }}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label('STATUS')}>STATUS</label>
                  <select style={{ ...input, cursor: 'pointer' }} value={partnerForm.status} onChange={e => setPartnerForm(f => ({ ...f, status: e.target.value }))}>
                    {['active', 'pending', 'inactive'].map(s => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label('CITY *')}>CITY *</label>
                  <input style={input} placeholder="e.g. Mumbai" value={partnerForm.city} onChange={e => setPartnerForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div>
                  <label style={label('AREA')}>AREA</label>
                  <input style={input} placeholder="e.g. Bandra West" value={partnerForm.area} onChange={e => setPartnerForm(f => ({ ...f, area: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={label('FULL ADDRESS')}>FULL ADDRESS</label>
                  <input style={input} placeholder="e.g. 123 Main St, Bandra West, Mumbai" value={partnerForm.address} onChange={e => setPartnerForm(f => ({ ...f, address: e.target.value }))} />
                </div>
                <div>
                  <label style={label('DISCOUNT %')}>DISCOUNT %</label>
                  <input style={input} type="number" placeholder="0" value={partnerForm.discountPercent} onChange={e => setPartnerForm(f => ({ ...f, discountPercent: e.target.value }))} />
                </div>
                <div>
                  <label style={label('DISTANCE LABEL')}>DISTANCE LABEL</label>
                  <input style={input} placeholder="e.g. 1.2 km" value={partnerForm.distanceLabel} onChange={e => setPartnerForm(f => ({ ...f, distanceLabel: e.target.value }))} />
                </div>
                <div>
                  <label style={label('COMMISSION RATE (%)')}>COMMISSION RATE (%)</label>
                  <input style={input} type="number" placeholder="25" value={partnerForm.commissionRate} onChange={e => setPartnerForm(f => ({ ...f, commissionRate: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={label('PHOTO URLs (comma-separated)')}>PHOTO URLs (comma-separated)</label>
                  <input style={input} placeholder="https://..." value={partnerForm.photos} onChange={e => setPartnerForm(f => ({ ...f, photos: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btn('green')} onClick={savePartner}><Check size={14} /> {editingPartner ? 'Update' : 'Add Spa Centre'}</button>
                <button style={btn()} onClick={() => { setShowPartnerForm(false); setEditingPartner(null); }}><X size={14} /> Cancel</button>
              </div>
            </div>
          )}

          {/* Partners table */}
          <div style={{ display: 'grid', gap: 10 }}>
            {partners.map(p => (
              <div key={p.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <span style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 16, color: '#fff' }}>{p.name}</span>
                    <span style={pill(statusColor[p.status] || '#aaa')}>{p.status}</span>
                    <span style={pill('#9B5DE5')}>{p.serviceType}</span>
                    {p.discountPercent > 0 && <span style={pill('#3DFF54')}>{p.discountPercent}% OFF</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}>
                      <MapPin size={13} /> {p.area}, {p.city}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}>
                      <Star size={13} /> {p.rating || '—'} ({p.reviewCount || 0} reviews)
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}>
                      <Percent size={13} /> {p.commissionRate ?? 'Not set'}{p.commissionRate != null ? '% commission' : ''}
                    </span>
                    {p.distanceLabel && (
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}>📍 {p.distanceLabel}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button style={btn()} onClick={() => openEditPartner(p)}><Edit3 size={14} /> Edit</button>
                  <button
                    style={{ ...btn(), background: 'rgba(255,255,255,0.05)', color: '#60A5FA', borderColor: 'rgba(96,165,250,0.2)' }}
                    onClick={() => { setSelectedPartnerId(p.id); setTab('services'); }}
                  >
                    <Tag size={14} /> Services ({services.filter(s => s.partnerId === p.id).length})
                  </button>
                  <button style={btn('red')} onClick={() => deletePartner(p.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {partners.length === 0 && (
              <div style={{ ...card, textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontFamily: 'DM Sans, sans-serif' }}>
                No spa centres yet. Click &quot;Add Spa Centre&quot; to get started.
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== SERVICES TAB ===== */}
      {tab === 'services' && (
        <>
          {/* Partner filter + Add button */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ ...label('FILTER BY SPA CENTRE'), marginBottom: 6 }}>FILTER BY SPA CENTRE</label>
              <select
                style={{ ...input, cursor: 'pointer' }}
                value={selectedPartnerId}
                onChange={e => setSelectedPartnerId(e.target.value)}
              >
                <option value="" style={{ background: '#111' }}>— All Spa Centres —</option>
                {partners.map(p => <option key={p.id} value={p.id} style={{ background: '#111' }}>{p.name}</option>)}
              </select>
            </div>
          </div>

          {/* Add/Edit Service form */}
          {showSvcForm && (
            <div style={{ ...card, marginBottom: 20, borderColor: 'rgba(61,255,84,0.2)' }}>
              <h3 style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, color: '#fff', margin: '0 0 20px', fontSize: 17 }}>
                {editingSvc ? 'Edit Service' : 'New Service'}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={label('SERVICE NAME *')}>SERVICE NAME *</label>
                  <input style={input} placeholder="e.g. Full Body Massage" value={svcForm.name} onChange={e => setSvcForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label style={label('CATEGORY')}>CATEGORY</label>
                  <select style={{ ...input, cursor: 'pointer' }} value={svcForm.category} onChange={e => setSvcForm(f => ({ ...f, category: e.target.value }))}>
                    {SERVICE_CATEGORIES.map(c => <option key={c} value={c} style={{ background: '#111' }}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label('SPA CENTRE')}>SPA CENTRE</label>
                  <select style={{ ...input, cursor: 'pointer' }} value={svcForm.partnerId} onChange={e => setSvcForm(f => ({ ...f, partnerId: e.target.value }))}>
                    <option value="" style={{ background: '#111' }}>— No centre —</option>
                    {partners.map(p => <option key={p.id} value={p.id} style={{ background: '#111' }}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label('PRICE (₹) *')}>PRICE (₹) *</label>
                  <input style={input} type="number" placeholder="999" value={svcForm.price} onChange={e => setSvcForm(f => ({ ...f, price: e.target.value }))} />
                </div>
                <div>
                  <label style={label('ORIGINAL PRICE (₹) — for strikethrough')}>ORIGINAL PRICE (₹)</label>
                  <input style={input} type="number" placeholder="1299" value={svcForm.originalPrice} onChange={e => setSvcForm(f => ({ ...f, originalPrice: e.target.value }))} />
                </div>
                <div>
                  <label style={label('DURATION (minutes)')}>DURATION (minutes)</label>
                  <input style={input} type="number" placeholder="60" value={svcForm.durationMinutes} onChange={e => setSvcForm(f => ({ ...f, durationMinutes: e.target.value }))} />
                </div>
                <div>
                  <label style={label('ACTIVE')}>ACTIVE</label>
                  <select style={{ ...input, cursor: 'pointer' }} value={svcForm.isActive ? 'true' : 'false'} onChange={e => setSvcForm(f => ({ ...f, isActive: e.target.value === 'true' }))}>
                    <option value="true" style={{ background: '#111' }}>Active</option>
                    <option value="false" style={{ background: '#111' }}>Inactive</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={label('IMAGE URL')}>IMAGE URL</label>
                  <input style={input} placeholder="https://..." value={svcForm.imageUrl} onChange={e => setSvcForm(f => ({ ...f, imageUrl: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btn('green')} onClick={saveService}><Check size={14} /> {editingSvc ? 'Update' : 'Add Service'}</button>
                <button style={btn()} onClick={() => { setShowSvcForm(false); setEditingSvc(null); }}><X size={14} /> Cancel</button>
              </div>
            </div>
          )}

          {/* Services list */}
          <div style={{ display: 'grid', gap: 10 }}>
            {filteredServices.map(svc => {
              const partner = partners.find(p => p.id === svc.partnerId);
              const cc = catColor[svc.category] || '#aaa';
              return (
                <div key={svc.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 16, opacity: svc.isActive ? 1 : 0.5 }}>
                  {svc.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={svc.imageUrl} alt={svc.name} style={{ width: 60, height: 60, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 15, color: '#fff' }}>{svc.name}</span>
                      <span style={pill(cc)}>{svc.category}</span>
                      {!svc.isActive && <span style={pill('#ff6b6b')}>Inactive</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#3DFF54', fontSize: 14, fontFamily: 'DM Sans, sans-serif', fontWeight: 700 }}>
                        ₹{svc.price}
                        {(svc.originalPrice ?? 0) > 0 && (
                          <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400, textDecoration: 'line-through', fontSize: 12 }}>₹{svc.originalPrice}</span>
                        )}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}>
                        <Clock size={13} /> {svc.durationMinutes} min
                      </span>
                      {partner && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}>
                          <Building2 size={13} /> {partner.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button style={btn()} onClick={() => openEditService(svc)}><Edit3 size={14} /> Edit</button>
                    <button
                      style={{ ...btn(), background: svc.isActive ? 'rgba(255,100,100,0.1)' : 'rgba(61,255,84,0.1)', color: svc.isActive ? '#ff6b6b' : '#3DFF54', borderColor: svc.isActive ? 'rgba(255,100,100,0.2)' : 'rgba(61,255,84,0.2)' }}
                      onClick={() => toggleService(svc.id)}
                    >
                      <Activity size={14} /> {svc.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button style={btn('red')} onClick={() => deleteService(svc.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
            {filteredServices.length === 0 && (
              <div style={{ ...card, textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontFamily: 'DM Sans, sans-serif' }}>
                {selectedPartnerId ? 'No services for this spa centre. Click "Add Service" to create one.' : 'No services yet.'}
              </div>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}
