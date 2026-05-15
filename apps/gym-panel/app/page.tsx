'use client';
import { useEffect, useState } from 'react';
import Shell from '../components/Shell';
import { Users, Calendar, Star, DollarSign, QrCode, TrendingUp } from 'lucide-react';
import { api, getUser } from '../lib/api';
import Link from 'next/link';

type GymInfo = { id: string; name: string; rating?: number; status?: string };
type Checkin = { id: string; userName?: string; userPhone?: string; planType?: string; checkinTime: string; status?: string };

function timeAgo(iso: string) {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

export default function GymDashboard() {
  const [gym, setGym] = useState<GymInfo | null>(null);
  const [checkinCount, setCheckinCount] = useState<number | null>(null);
  const [recentCheckins, setRecentCheckins] = useState<Checkin[]>([]);
  const [activeMembers, setActiveMembers] = useState<number | null>(null);
  const [totalMembers, setTotalMembers] = useState<number | null>(null);
  const [mtdRevenue, setMtdRevenue] = useState<number | null>(null);
  const [lifetimeRevenue, setLifetimeRevenue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const results = await Promise.allSettled([
        api.get<GymInfo>('/gyms/my-gym'),
        api.get<{ count: number }>('/checkins/today-count'),
        api.get<any>('/gyms/my-checkins?limit=6'),
        api.get<any>('/gyms/my-members?limit=1'),
        api.get<any>('/settlements/my-gym'),
      ]);
      if (results[0].status === 'fulfilled') setGym(results[0].value);
      if (results[1].status === 'fulfilled') setCheckinCount(results[1].value?.count ?? null);
      const raw2 = results[2].status === 'fulfilled' ? results[2].value : null;
      const checkins: Checkin[] = Array.isArray(raw2) ? raw2 : (raw2 as any)?.data ?? [];
      setRecentCheckins(checkins);
      const rawMembers = results[3].status === 'fulfilled' ? results[3].value : null;
      const members = Array.isArray(rawMembers) ? rawMembers : rawMembers?.members || rawMembers?.data || [];
      setActiveMembers(rawMembers?.stats?.active ?? (Array.isArray(members) ? members.filter((m: any) => (m.status || '').toLowerCase() === 'active').length : null));
      setTotalMembers(rawMembers?.stats?.total ?? rawMembers?.total ?? (Array.isArray(members) ? members.length : null));
      const settlementData = results[4].status === 'fulfilled' ? results[4].value : null;
      setMtdRevenue(Number(settlementData?.current?.netPayout || 0) || null);
      setLifetimeRevenue(Number(settlementData?.current?.lifetimeGymEarned || settlementData?.current?.lifetimeNetPayout || 0) || null);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const stats = [
    { label: 'Total Members', value: totalMembers !== null ? String(totalMembers) : '-', change: 'all', icon: Users },
    { label: 'Till Date Earned', value: lifetimeRevenue !== null ? `Rs ${lifetimeRevenue.toLocaleString('en-IN')}` : 'Rs -', change: 'all time', icon: TrendingUp },
    { label: "Today's Check-ins", value: checkinCount !== null ? String(checkinCount) : '—', change: 'today', icon: Calendar },
    { label: 'Active Members', value: activeMembers !== null ? String(activeMembers) : '—', change: 'live', icon: Users },
    { label: 'Avg Rating', value: gym?.rating ? String(gym.rating) : '—', change: 'live', icon: Star },
    { label: 'MTD Revenue', value: mtdRevenue !== null ? `₹${mtdRevenue.toLocaleString('en-IN')}` : '₹—', change: 'month', icon: DollarSign },
    { label: 'QR Scans', value: checkinCount !== null ? String(checkinCount) : '—', change: 'today', icon: QrCode },
    { label: 'Trend', value: '—', change: 'needs report API', icon: TrendingUp },
  ];

  return (
    <Shell title={gym?.name || 'Dashboard'}>
      {loading && (
        <div className="text-sm mb-4" style={{ color: 'var(--t2)' }}>Loading dashboard…</div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card stat-glow p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
                  <Icon size={16} style={{ color: 'var(--accent)' }} />
                </div>
                <span className="accent-pill">{s.change}</span>
              </div>
              <div className="text-2xl font-bold tracking-tight">{s.value}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--t2)' }}>{s.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass p-6">
          <h3 className="serif text-lg mb-4">Recent Check-ins</h3>
          <div className="space-y-4">
            {recentCheckins.slice(0, 6).map((c) => (
              <div key={c.id} className="flex items-center justify-between" style={{ fontSize: 13 }}>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                    {(c.userName || '?').charAt(0)}
                  </div>
                  <div>
                    <span className="text-white font-semibold">{c.userName || 'Unknown'}</span>
                    {c.planType && <span className="ml-2 accent-pill">{c.planType}</span>}
                  </div>
                </div>
                <span style={{ color: 'var(--t3)', fontSize: 12 }}>{timeAgo(c.checkinTime)}</span>
              </div>
            ))}
            {recentCheckins.length === 0 && (
              <p style={{ color: 'var(--t2)', fontSize: 13 }}>No check-ins yet today.</p>
            )}
          </div>
        </div>

        <div className="glass p-6">
          <h3 className="serif text-lg mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/scanner" className="btn btn-primary text-sm justify-center">Open Scanner</Link>
            <Link href="/members" className="btn btn-ghost text-sm justify-center">View Members</Link>
            <Link href="/sessions" className="btn btn-ghost text-sm justify-center">Session Schedule</Link>
            <Link href="/settlement" className="btn btn-ghost text-sm justify-center">Settlement</Link>
          </div>
          {gym && (
            <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="kicker mb-2">Gym Status</div>
              <div className="flex items-center gap-2">
                <span className={gym.status === 'active' ? 'badge-active' : 'badge-pending'}>{gym.status || 'active'}</span>
                <span style={{ fontSize: 12, color: 'var(--t2)' }}>{gym.name}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
