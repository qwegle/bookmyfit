'use client';
import { useCallback, useEffect, useState } from 'react';
import Shell from '../../components/Shell';
import { Check, Plus, Clock, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';

interface Amenity { id?: string; _id?: string; name: string; status?: string; }

function toAmenityArray(data: any): Amenity[] {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.data) ? data.data : [];
}

function SkeletonPill() {
  return <div style={{ height: 36, width: 90, borderRadius: 20, background: 'rgba(255,255,255,0.07)', animation: 'pulse 1.5s ease-in-out infinite' }} />;
}

export default function AmenitiesPage() {
  const { toast } = useToast();
  const [gymId, setGymId] = useState('');
  const [gymAmenities, setGymAmenities] = useState<string[]>([]);
  const [allAmenities, setAllAmenities] = useState<Amenity[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadAmenities = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [gymData, masterData, requestData] = await Promise.all([
        api.get<any>('/gyms/my-gym'),
        api.get<Amenity[]>('/master/amenities'),
        api.get<Amenity[]>('/master/amenities/my-requests').catch(() => [] as Amenity[]),
      ]);
      setGymId(gymData._id || gymData.id || '');
      const amenNames: string[] = (gymData.amenities || []).map((a: any) =>
        typeof a === 'string' ? a : (a.name || '')
      );
      setGymAmenities(amenNames);
      setAllAmenities(toAmenityArray(masterData));
      setPendingRequests(toAmenityArray(requestData).filter((a) => a.status === 'pending').map((a) => a.name));
    } catch {
      setError('Failed to load amenities. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAmenities(); }, [loadAmenities]);

  const toggleAmenity = async (name: string) => {
    if (!gymId || toggling) return;
    setToggling(name);
    const isSelected = gymAmenities.includes(name);
    const updated = isSelected ? gymAmenities.filter(a => a !== name) : [...gymAmenities, name];
    try {
      await api.put('/gyms/my-gym/amenities', { amenities: updated });
      setGymAmenities(updated);
      toast(isSelected ? `Removed: ${name}` : `Added: ${name}`, 'success');
    } catch {
      toast('Failed to update amenities', 'error');
    } finally {
      setToggling(null);
    }
  };

  const requestAmenity = async () => {
    if (!newName.trim() || requesting) return;
    const cleanName = newName.trim();
    setRequesting(true);
    try {
      const result = await api.post<Amenity>('/master/amenities/request', { name: cleanName });
      const amenityName = result?.name || cleanName;
      if (result?.status === 'pending') {
        setPendingRequests(p => p.includes(amenityName) ? p : [...p, amenityName]);
        toast('Request submitted - pending admin approval', 'info');
      } else {
        setAllAmenities(p => p.some(a => a.name === amenityName) ? p : [...p, { id: result?.id, _id: result?._id, name: amenityName, status: result?.status }]);
        toast(`${amenityName} is already available. You can select it now.`, 'info');
      }
      setNewName('');
    } catch {
      toast('Failed to submit request', 'error');
    } finally {
      setRequesting(false);
    }
  };

  const allNames = allAmenities.map(a => a.name);

  return (
    <Shell title="Amenities">
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      {error && (
        <div className="card p-3 mb-4 text-xs" style={{ color: '#FFB400', background: 'rgba(255,180,0,0.05)', borderColor: 'rgba(255,180,0,0.3)' }}>
          <AlertTriangle size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> {error}
        </div>
      )}

      <div className="glass p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="serif text-lg">Your Amenities</h3>
          <span style={{ fontSize: 12, color: 'var(--t3)' }}>{gymAmenities.length} active</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonPill key={i} />)
            : gymAmenities.length === 0
              ? <p style={{ color: 'var(--t3)', fontSize: 13 }}>No amenities added yet. Select from the list below.</p>
              : gymAmenities.map(name => (
                <button
                  key={name}
                  onClick={() => toggleAmenity(name)}
                  disabled={toggling === name}
                  className="card px-4 py-2.5 flex items-center gap-2 cursor-pointer"
                  style={{ borderColor: 'var(--accent-border)', background: 'var(--accent-soft)', opacity: toggling === name ? 0.6 : 1, border: 'none' }}
                >
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)' }}>{name}</span>
                  <Check size={11} color="var(--accent)" />
                </button>
              ))}
        </div>
      </div>

      <div className="glass p-6 mb-5">
        <h3 className="serif text-lg mb-1">All Available Amenities</h3>
        <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 16 }}>Click any amenity to toggle it on or off for your gym</p>
        <div className="flex flex-wrap gap-2">
          {loading
            ? Array.from({ length: 12 }).map((_, i) => <SkeletonPill key={i} />)
            : allNames.length === 0
              ? <p style={{ color: 'var(--t3)', fontSize: 13 }}>No amenities available from master list.</p>
              : allNames.map(name => {
                const active = gymAmenities.includes(name);
                return (
                  <button
                    key={name}
                    onClick={() => toggleAmenity(name)}
                    disabled={toggling === name}
                    className="card px-4 py-2.5 flex items-center gap-2 cursor-pointer"
                    style={{
                      borderColor: active ? 'var(--accent-border)' : undefined,
                      background: active ? 'var(--accent-soft)' : undefined,
                      opacity: toggling === name ? 0.6 : 1,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 500, color: active ? 'var(--accent)' : 'var(--t)' }}>{name}</span>
                    {active && <Check size={11} color="var(--accent)" />}
                  </button>
                );
              })}
        </div>
      </div>

      {pendingRequests.length > 0 && (
        <div className="glass p-6 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} style={{ color: '#FFB400' }} />
            <h3 className="serif text-lg">Pending Requests</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {pendingRequests.map(name => (
              <span key={name} className="badge-pending" style={{ padding: '4px 12px', fontSize: 12 }}>{name}</span>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 8 }}>These will appear in the app once approved by admin.</p>
        </div>
      )}

      <div className="glass p-6">
        <div className="flex items-center gap-2 mb-2">
          <Plus size={16} style={{ color: 'var(--accent)' }} />
          <h3 className="serif text-lg">Request New Amenity</h3>
        </div>
        <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 16 }}>
          Can&apos;t find what you need? Request a new amenity for admin review.
        </p>
        <div className="flex gap-3">
          <input
            className="glass-input flex-1"
            placeholder="Enter amenity name (e.g. Cryotherapy, Rooftop Track)..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && requestAmenity()}
            disabled={requesting}
          />
          <button
            className="btn btn-primary"
            onClick={requestAmenity}
            disabled={requesting || !newName.trim()}
            style={{ opacity: requesting || !newName.trim() ? 0.6 : 1 }}
          >
            {requesting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--t3)' }}>
          New amenity requests require admin approval before appearing in the app.
        </p>
      </div>
    </Shell>
  );
}
