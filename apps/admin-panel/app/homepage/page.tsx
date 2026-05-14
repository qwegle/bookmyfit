'use client';
import { useCallback, useEffect, useState } from 'react';
import Shell from '../../components/Shell';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { Info, ToggleLeft, ToggleRight } from 'lucide-react';

type SectionConfig = {
  order: number;
  name: string;
  type: string;
  status: 'Active' | 'Draft';
  items: number;
};

// Maps backend section ids to display metadata
const SECTION_META: Record<string, { name: string; type: string; items: number }> = {
  hero:          { name: 'Hero Banner Carousel', type: 'Carousel', items: 3 },
  featured_gyms: { name: 'Featured Gyms',        type: 'Grid',     items: 6 },
  plans:         { name: 'Choose a Plan',         type: 'Grid',     items: 4 },
  stats:         { name: 'Stats',                 type: 'List',     items: 0 },
};

const DEFAULT_SECTIONS: SectionConfig[] = [
  { order: 1, name: 'Hero Banner Carousel', type: 'Carousel', status: 'Active', items: 3 },
  { order: 2, name: 'Featured Gyms', type: 'Grid', status: 'Active', items: 6 },
  { order: 3, name: 'Workout Categories', type: 'Horizontal Scroll', status: 'Active', items: 8 },
  { order: 4, name: 'Store Picks', type: 'Grid', status: 'Active', items: 4 },
  { order: 5, name: 'Trending Near You', type: 'List', status: 'Draft', items: 0 },
];

function backendToUi(backendSections: any[]): SectionConfig[] {
  return [...backendSections]
    .sort((a, b) => a.order - b.order)
    .map((s) => {
      const meta = SECTION_META[s.id] ?? { name: s.title || s.id, type: s.type || 'List', items: 0 };
      return {
        order: s.order + 1,
        name: meta.name,
        type: meta.type,
        status: s.visible ? 'Active' : 'Draft',
        items: meta.items,
      };
    });
}

function uiToBackend(sections: SectionConfig[], original: any[]): any[] {
  return original.map((s) => {
    const uiItem = sections.find((u) => u.order === s.order + 1);
    if (!uiItem) return s;
    return { ...s, visible: uiItem.status === 'Active' };
  });
}

export default function HomepagePage() {
  const { toast } = useToast();
  const [sections, setSections] = useState<SectionConfig[]>(DEFAULT_SECTIONS);
  const [backendSections, setBackendSections] = useState<any[]>([]);
  const [featuredGyms, setFeaturedGyms] = useState<any[]>([]);
  const [gymsLoading, setGymsLoading] = useState(true);

  // Load config from backend on mount
  useEffect(() => {
    api.get('/homepage/config')
      .then((data: any) => {
        if (data?.sections?.length) {
          setBackendSections(data.sections);
          setSections(backendToUi(data.sections));
        }
      })
      .catch(() => { /* keep defaults */ });
  }, []);

  const saveToApi = useCallback(async (updated: SectionConfig[]) => {
    const newBackend = uiToBackend(updated, backendSections);
    try {
      await api.put('/homepage/config', { sections: newBackend });
    } catch { /* ignore save errors */ }
  }, [backendSections]);

  const loadFeaturedGyms = useCallback(async () => {
    setGymsLoading(true);
    try {
      const res: any = await api.get('/gyms?page=1&limit=6');
      const arr = Array.isArray(res) ? res : res?.data ?? [];
      setFeaturedGyms(arr.slice(0, 6));
    } catch {
      setFeaturedGyms([]);
    } finally {
      setGymsLoading(false);
    }
  }, []);

  useEffect(() => { loadFeaturedGyms(); }, [loadFeaturedGyms]);

  const toggleStatus = (order: number) => {
    setSections((prev) => {
      const updated: SectionConfig[] = prev.map((s) =>
        s.order === order ? { ...s, status: (s.status === 'Active' ? 'Draft' : 'Active') as 'Active' | 'Draft' } : s
      );
      saveToApi(updated);
      const section = updated.find((s) => s.order === order);
      toast(`"${section?.name}" set to ${section?.status}`);
      return updated;
    });
  };

  const activeSections = sections.filter((s) => s.status === 'Active');

  return (
    <Shell title="Homepage Builder">
      {/* Info banner */}
      <div className="card p-4 mb-6 flex items-start gap-3" style={{ borderColor: 'rgba(100,160,255,0.3)', background: 'rgba(100,160,255,0.06)' }}>
        <Info size={16} style={{ color: '#64A0FF', flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--t)' }}>Homepage Builder</strong> — changes made here are reflected in the mobile
          app&apos;s featured sections. Toggle sections between Active and Draft to control what users see.
          Visibility config is stored locally; connect a CMS API for team-wide changes.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        {/* Sections table */}
        <div className="lg:col-span-2 glass p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="serif text-lg" style={{ margin: 0 }}>Sections</h3>
              <p style={{ fontSize: 12, color: 'var(--t3)', margin: '4px 0 0' }}>
                {activeSections.length} of {sections.length} active
              </p>
            </div>
          </div>
          <table className="glass-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Section</th>
                <th>Type</th>
                <th>Items</th>
                <th>Status</th>
                <th>Toggle</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((s) => (
                <tr key={s.order}>
                  <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{s.order}</td>
                  <td className="font-semibold text-white">{s.name}</td>
                  <td><span className="accent-pill">{s.type}</span></td>
                  <td style={{ color: 'var(--t2)' }}>{s.items > 0 ? s.items : '—'}</td>
                  <td>
                    <span className={s.status === 'Active' ? 'badge-active' : 'badge-pending'}>
                      {s.status}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => toggleStatus(s.order)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                      title={`Set to ${s.status === 'Active' ? 'Draft' : 'Active'}`}
                    >
                      {s.status === 'Active'
                        ? <ToggleRight size={22} style={{ color: 'var(--accent)' }} />
                        : <ToggleLeft size={22} style={{ color: 'var(--t3)' }} />
                      }
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Featured Gyms preview */}
          <div style={{ marginTop: 28 }}>
            <h4 className="kicker" style={{ marginBottom: 12 }}>Current Featured Gyms (live from API)</h4>
            {gymsLoading ? (
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse" style={{ height: 60, borderRadius: 10, background: 'var(--surface)' }} />
                ))}
              </div>
            ) : featuredGyms.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--t3)' }}>No featured gyms found from API.</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {featuredGyms.map((gym, i) => (
                  <div key={gym.id ?? i} className="glass p-3" style={{ borderRadius: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t)', marginBottom: 2 }}>{gym.name ?? 'Unnamed Gym'}</div>
                    <div style={{ fontSize: 11, color: 'var(--t3)' }}>{gym.city ?? gym.location ?? '—'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Phone preview */}
        <div className="glass p-6">
          <h3 className="serif text-lg mb-4">Preview</h3>
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)', aspectRatio: '9/16' }}>
            <div className="p-4 space-y-3">
              {activeSections.map((s) => {
                if (s.type === 'Carousel') {
                  return (
                    <div key={s.order}>
                      <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.name}</div>
                      <div style={{ height: 52, borderRadius: 10, background: 'linear-gradient(135deg, var(--accent-glow, rgba(0,200,100,0.2)), rgba(0,120,255,0.2))' }} />
                    </div>
                  );
                }
                if (s.type === 'Grid') {
                  return (
                    <div key={s.order}>
                      <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.name}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                        {Array.from({ length: Math.min(s.items, 4) }).map((_, i) => (
                          <div key={i} style={{ height: 32, borderRadius: 6, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }} />
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={s.order}>
                    <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.name}</div>
                    <div style={{ display: 'flex', gap: 4, overflowX: 'hidden' }}>
                      {Array.from({ length: Math.min(s.items || 3, 3) }).map((_, i) => (
                        <div key={i} style={{ height: 24, flex: '0 0 40%', borderRadius: 20, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }} />
                      ))}
                    </div>
                  </div>
                );
              })}
              {activeSections.length === 0 && (
                <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 11, color: 'var(--t3)' }}>
                  No active sections
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
