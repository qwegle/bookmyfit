'use client';

import Shell from '../../components/Shell';
import { api } from '../../lib/api';
import { useEffect, useState, useRef } from 'react';
import { Building2, MapPin, Phone, Mail, Globe, Star, Upload, Check, AlertTriangle } from 'lucide-react';

interface FormState {
  displayName: string;
  description: string;
  address: string;
  city: string;
  area: string;
  pinCode: string;
  phone: string;
  email: string;
  website: string;
  lat: string;
  lng: string;
}

export default function ProfilePage() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>({
    displayName: '',
    description: '',
    address: '',
    city: '',
    area: '',
    pinCode: '',
    phone: '',
    email: '',
    website: '',
    lat: '',
    lng: '',
  });

  const [gymId, setGymId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partnerTier, setPartnerTier] = useState('');
  const [rating, setRating] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.get('/gyms/my-gym');
        setGymId(data._id || data.id || '');
        setPartnerTier(data.partnerTier || data.tier || '');
        setRating(data.rating || data.avgRating || null);
        setForm({
          displayName: data.name || data.displayName || '',
          description: data.description || '',
          address: data.address || '',
          city: data.city || '',
          area: data.area || '',
          pinCode: data.pinCode || data.pincode || '',
          phone: data.phone || data.contactPhone || '',
          email: data.email || data.contactEmail || '',
          website: data.website || '',
          lat: data.lat != null ? String(data.lat) : '',
          lng: data.lng != null ? String(data.lng) : '',
        });
      } catch (e: any) {
        setError(e?.message || 'Could not load gym profile.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const endpoint = gymId ? `/gyms/${gymId}` : '/gyms/my-gym';
      await api.put(endpoint, {
        name: form.displayName,
        description: form.description,
        address: form.address,
        city: form.city,
        area: form.area,
        pinCode: form.pinCode,
        contactPhone: form.phone,
        contactEmail: form.email,
        website: form.website,
        lat: form.lat,
        lng: form.lng,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <Shell title="Gym Profile">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN */}
        <div className="glass p-6 flex flex-col items-center gap-4">
          {loading ? (
            <>
              <div className="w-20 h-20 rounded-full animate-pulse" style={{ background: 'var(--surface)' }} />
              <div className="w-24 h-4 rounded animate-pulse" style={{ background: 'var(--surface)' }} />
              <div className="w-32 h-3 rounded animate-pulse" style={{ background: 'var(--surface)' }} />
              <div className="w-full space-y-3 mt-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-4 rounded animate-pulse" style={{ background: 'var(--surface)' }} />
                ))}
              </div>
            </>
          ) : (
            <>
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: 'var(--surface)', border: '2px solid var(--accent)' }}
              >
                <Building2 size={32} style={{ color: 'var(--accent)' }} />
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
              />
              <button
                className="btn btn-ghost flex items-center gap-2 text-xs"
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={14} />
                Upload Photo
              </button>

              <div className="text-center">
                <p className="serif text-lg font-bold" style={{ color: 'var(--t)' }}>
                  {form.displayName || '--'}
                </p>
              </div>

              {partnerTier && <span className="accent-pill">{partnerTier}</span>}

              {rating !== null && (
                <div className="flex items-center gap-1">
                  <Star size={14} style={{ color: 'var(--accent)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--t)' }}>{Number(rating).toFixed(1)}</span>
                </div>
              )}

              <div className="w-full space-y-2 mt-2">
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--t2)' }}>
                  <MapPin size={14} />
                  <span>{form.address || '--'}{form.area ? `, ${form.area}` : ''}{form.city ? `, ${form.city}` : ''}</span>
                </div>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--t2)' }}>
                  <Phone size={14} />
                  <span>{form.phone || '--'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--t2)' }}>
                  <Mail size={14} />
                  <span>{form.email || '--'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--t2)' }}>
                  <Globe size={14} />
                  <span>{form.website || '--'}</span>
                </div>
                <div
                  className="rounded-xl p-3 mt-3"
                  style={{ background: 'rgba(61,255,84,0.07)', border: '1px solid rgba(61,255,84,0.16)' }}
                >
                  <div className="text-xs font-semibold mb-1" style={{ color: 'var(--accent)' }}>Operating hours</div>
                  <div className="text-xs leading-relaxed" style={{ color: 'var(--t2)' }}>
                    Opening, closing, and break time are managed from the Operating Hours page.
                  </div>
                  <a href="/schedule" className="btn btn-ghost inline-flex mt-3 text-xs">Manage Hours</a>
                </div>
              </div>
            </>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-2 glass p-6">
          <p className="serif text-lg font-bold mb-5" style={{ color: 'var(--t)' }}>Edit Profile</p>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--error)' }}>
                  <AlertTriangle size={14} /> {error}
                </div>
              )}
              {/* Display Name */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--t2)' }}>
                  Display Name
                </label>
                <input
                  className="glass-input w-full"
                  value={form.displayName}
                  onChange={handleChange('displayName')}
                  placeholder="Gym display name"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--t2)' }}>
                  Description
                </label>
                <textarea
                  className="glass-input w-full h-20 resize-none"
                  value={form.description}
                  onChange={handleChange('description')}
                  placeholder="Brief description of your gym"
                />
              </div>

              {/* Address */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--t2)' }}>
                  Address
                </label>
                <input
                  className="glass-input w-full"
                  value={form.address}
                  onChange={handleChange('address')}
                  placeholder="Street address"
                />
              </div>

              {/* City + Pin Code */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--t2)' }}>
                    Area
                  </label>
                  <input
                    className="glass-input w-full"
                    value={form.area}
                    onChange={handleChange('area')}
                    placeholder="Area / locality"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--t2)' }}>
                    City
                  </label>
                  <input
                    className="glass-input w-full"
                    value={form.city}
                    onChange={handleChange('city')}
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--t2)' }}>
                    Pin Code
                  </label>
                  <input
                    className="glass-input w-full"
                    value={form.pinCode}
                    onChange={handleChange('pinCode')}
                    placeholder="Pin code"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--t2)' }}>
                    Latitude
                  </label>
                  <input
                    className="glass-input w-full"
                    value={form.lat}
                    onChange={handleChange('lat')}
                    placeholder="e.g. 20.2961"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--t2)' }}>
                    Longitude
                  </label>
                  <input
                    className="glass-input w-full"
                    value={form.lng}
                    onChange={handleChange('lng')}
                    placeholder="e.g. 85.8245"
                  />
                </div>
              </div>

              {/* Phone + Email */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--t2)' }}>
                    Phone
                  </label>
                  <input
                    className="glass-input w-full"
                    value={form.phone}
                    onChange={handleChange('phone')}
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--t2)' }}>
                    Email
                  </label>
                  <input
                    className="glass-input w-full"
                    value={form.email}
                    onChange={handleChange('email')}
                    placeholder="contact@yourgym.com"
                    type="email"
                  />
                </div>
              </div>

              {/* Website */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--t2)' }}>
                  Website
                </label>
                <input
                  className="glass-input w-full"
                  value={form.website}
                  onChange={handleChange('website')}
                  placeholder="www.yourgym.com"
                />
              </div>

              {/* Save Button */}
              <button
                className="btn btn-primary w-full mt-4 flex items-center justify-center gap-2"
                onClick={handleSave}
                disabled={saving}
              >
                <Check size={16} />
                {saving ? 'Saving...' : 'Save Profile'}
              </button>

              {saved && (
                <div className="flex items-center gap-2 text-sm mt-2" style={{ color: 'var(--accent)' }}>
                  <Check size={14} />
                  Profile saved successfully.
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-sm mt-2" style={{ color: 'var(--error)' }}>
                  <AlertTriangle size={14} />
                  {error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
