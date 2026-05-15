'use client';
import { useEffect, useState } from 'react';
import Shell from '../components/Shell';
import { api } from '../lib/api';
import Link from 'next/link';
import { Building2, Users, CreditCard, TrendingUp, DollarSign, Calendar, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface Summary {
  totalRevenue: number;
  activeSubscribers: number;
  newSignups: number;
  avgCheckinsPerDay: number;
  totalGyms: number;
  pendingKyc: number;
}

interface RecentSub {
  id: string;
  user?: { name?: string; email?: string };
  plan?: { name?: string };
  userName?: string;
  planName?: string;
  gymName?: string;
  amountPaid?: number;
  planType?: string;
  status: string;
  createdAt: string;
}

export default function AdminDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recentSubs, setRecentSubs] = useState<RecentSub[]>([]);
  const [gyms, setGyms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/summary').catch(() => null),
      api.get('/subscriptions/all').catch(() => ({})),
      api.get('/gyms/admin/list?limit=200').catch(() => ({})),
    ]).then(([sum, subs, gymRes]) => {
      setSummary(sum as Summary);
      const subsArr = Array.isArray(subs) ? subs : (subs as any)?.data ?? [];
      setRecentSubs(subsArr.slice(0, 5));
      const gymArr = Array.isArray(gymRes) ? gymRes : (gymRes as any)?.data ?? [];
      setGyms(gymArr);
    }).finally(() => setLoading(false));
  }, []);

  const totalGyms = gyms.length || summary?.totalGyms || 0;
  const pendingGyms = gyms.filter((g: any) => g.kycStatus === 'in_review').length || summary?.pendingKyc || 0;
  const activeGyms = gyms.filter((g: any) => g.status === 'active').length;

  const stats = [
    { label: 'Total Gyms', value: loading ? '—' : String(totalGyms), sub: `${activeGyms} active`, icon: Building2 },
    { label: 'Active Subscribers', value: loading ? '—' : (summary?.activeSubscribers?.toLocaleString() ?? '—'), sub: `+${summary?.newSignups ?? 0} this month`, icon: Users },
    { label: 'Monthly Revenue', value: loading ? '—' : summary ? `₹${(summary.totalRevenue / 100000).toFixed(1)}L` : '—', sub: 'Gross collected', icon: DollarSign },
    { label: 'Avg Daily Check-ins', value: loading ? '—' : (summary?.avgCheckinsPerDay?.toLocaleString() ?? '—'), sub: 'Per day average', icon: Calendar },
    { label: 'New Sign-ups', value: loading ? '—' : (summary?.newSignups?.toLocaleString() ?? '—'), sub: 'This month', icon: TrendingUp },
    { label: 'Pending KYC', value: loading ? '—' : String(pendingGyms), sub: 'Gyms awaiting review', icon: Clock },
  ];

  return (
    <Shell title="Dashboard">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card stat-glow p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
                  <Icon size={16} style={{ color: 'var(--accent)' }} />
                </div>
              </div>
              <div className="text-2xl font-bold tracking-tight">{s.value}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--t2)' }}>{s.label}</div>
              {s.sub && <div className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>{s.sub}</div>}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass p-6">
          <h3 className="serif text-lg mb-4">Recent Subscriptions</h3>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="animate-pulse h-8 rounded" style={{ background: 'var(--surface)' }} />)}
            </div>
          ) : recentSubs.length === 0 ? (
            <p style={{ color: 'var(--t3)', fontSize: 13 }}>No subscriptions yet</p>
          ) : (
            <div className="space-y-3">
              {recentSubs.map((s) => (
                <div key={s.id} className="flex justify-between items-center text-[13px]" style={{ color: 'var(--t)' }}>
                  <div>
                    <span className="font-semibold">{s.userName || s.user?.name || s.user?.email || 'User'}</span>
                    <span style={{ color: 'var(--t3)', marginLeft: 6 }}>{s.planName || s.plan?.name || s.planType || 'Plan'}</span>
                    {s.gymName && <span style={{ color: 'var(--t3)', marginLeft: 6 }}>· {s.gymName}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ color: 'var(--t3)' }}>{s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN') : ''}</span>
                    {s.status === 'active' ? (
                      <CheckCircle size={13} style={{ color: 'var(--accent)' }} />
                    ) : (
                      <Clock size={13} style={{ color: 'var(--t3)' }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass p-6">
          <h3 className="serif text-lg mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/gyms" className="btn btn-primary text-sm text-center">Approve Gyms</Link>
            <Link href="/kyc" className="btn btn-primary text-sm text-center">Review KYC</Link>
            <Link href="/settlements" className="btn btn-ghost text-sm text-center">Settlements</Link>
            <Link href="/notifications" className="btn btn-ghost text-sm text-center">Send Notification</Link>
            <Link href="/bookings" className="btn btn-ghost text-sm text-center">All Bookings</Link>
            <Link href="/analytics" className="btn btn-ghost text-sm text-center">Analytics</Link>
          </div>
          <div className="mt-5 p-4 rounded-xl" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-border)' }}>
            <div className="text-xs font-bold mb-1" style={{ color: 'var(--accent)' }}>PLATFORM HEALTH</div>
            <div className="text-[13px]" style={{ color: 'var(--t)' }}>
              {gyms.length > 0 ? `${activeGyms} gyms active · ${pendingGyms} pending review` : 'Loading platform status...'}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
