'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutDashboard, QrCode, Calendar, Users, Building2, CreditCard, UserSquare2, Sparkles, DollarSign, FileBarChart, Settings, LogOut, ShieldCheck, AlertTriangle, Clock, Activity } from 'lucide-react';

const NAV = [
  { group: 'Main', items: [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/scanner', label: 'Check-in Scanner', icon: QrCode },
    { href: '/checkins', label: 'Check-in Records', icon: Activity },
    { href: '/sessions', label: 'Sessions', icon: Calendar },
    { href: '/members', label: 'Members', icon: Users },
  ]},
  { group: 'Gym Setup', items: [
    { href: '/schedule', label: 'Operating Hours', icon: Clock },
    { href: '/profile', label: 'Profile', icon: Building2 },
    { href: '/plans', label: 'Plans', icon: CreditCard },
    { href: '/trainers', label: 'Trainers', icon: UserSquare2 },
    { href: '/amenities', label: 'Amenities', icon: Sparkles },
    { href: '/kyc', label: 'KYC', icon: ShieldCheck },
  ]},
  { group: 'Finance', items: [
    { href: '/settlement', label: 'Settlement', icon: DollarSign },
    { href: '/reports', label: 'Reports', icon: FileBarChart },
  ]},
  { group: 'System', items: [
    { href: '/settings', label: 'Settings', icon: Settings },
  ]},
];

type GymStatus = 'pending' | 'active' | 'suspended' | 'rejected' | 'inactive';

const STATUS_BANNERS: Record<string, { bg: string; border: string; text: string; msg: string }> = {
  pending: {
    bg: 'rgba(255,180,0,0.07)', border: 'rgba(255,180,0,0.3)', text: '#FFB400',
    msg: 'Your gym is pending activation. Complete KYC verification to go live on the platform.',
  },
  suspended: {
    bg: 'rgba(255,100,100,0.07)', border: 'rgba(255,100,100,0.3)', text: '#FF6464',
    msg: 'Your gym account has been suspended. Please contact support.',
  },
  rejected: {
    bg: 'rgba(255,100,100,0.07)', border: 'rgba(255,100,100,0.3)', text: '#FF6464',
    msg: 'Your gym registration was rejected. Please contact support or re-submit your KYC.',
  },
  inactive: {
    bg: 'rgba(255,100,100,0.07)', border: 'rgba(255,100,100,0.3)', text: '#FF6464',
    msg: 'Your gym is currently inactive and hidden from the member app. Please contact admin to reactivate it.',
  },
};

export default function Shell({ children, title }: { children: React.ReactNode; title: string }) {
  const pathname = usePathname();
  const [gymStatus, setGymStatus] = useState<GymStatus | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('bmf_gym_token');
    if (!token) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003'}/api/v1/gyms/my-gym`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => { if (data?.status) setGymStatus(data.status); })
      .catch(() => {});
  }, []);

  const banner = gymStatus && gymStatus !== 'active' ? STATUS_BANNERS[gymStatus] : null;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen text-white">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static z-50 top-0 left-0 h-full lg:h-auto w-64 border-r flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#080808' }}>
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div>
            <div className="serif" style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-1px' }}>
              Book<em style={{ fontStyle: 'italic', fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>My</em>Fit
            </div>
            <div className="kicker mt-1" style={{ color: 'var(--accent)', opacity: 0.7 }}>Gym Partner</div>
          </div>
          <button className="lg:hidden p-1" onClick={() => setSidebarOpen(false)} style={{ color: 'rgba(255,255,255,0.5)' }}>✕</button>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {NAV.map((g) => (
            <div key={g.group} className="mb-5">
              <div className="px-5 mb-2 kicker" style={{ color: 'rgba(255,255,255,0.3)' }}>{g.group}</div>
              {g.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 px-5 py-2.5 text-[13px] transition"
                    style={{
                      color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                      background: active ? 'rgba(61,255,84,0.08)' : 'transparent',
                      borderLeft: active ? '2px solid #3DFF54' : '2px solid transparent',
                      fontWeight: active ? 600 : 400,
                    }}>
                    <Icon size={15} strokeWidth={1.8} />
                    <span>{item.label}</span>
                    {item.href === '/kyc' && gymStatus && gymStatus !== 'active' && (
                      <span style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#FFB400', flexShrink: 0 }} />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="p-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => { localStorage.removeItem('bmf_gym_token'); localStorage.removeItem('bmf_gym_user'); window.location.href = '/login'; }}
            className="flex items-center gap-2 text-[12px] w-full px-3 py-2 rounded-lg transition hover:bg-red-500/10"
            style={{ color: 'rgba(255,100,100,0.8)' }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b px-4 lg:px-8 flex items-center justify-between sticky top-0 z-30" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)' }}>
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)' }} onClick={() => setSidebarOpen(true)}>
              <span className="block w-4 h-px bg-white mb-1" /><span className="block w-4 h-px bg-white mb-1" /><span className="block w-4 h-px bg-white" />
            </button>
            <h1 className="serif" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px' }}>{title}</h1>
          </div>
          <div className="accent-pill text-xs">{gymStatus === 'active' ? 'Live' : gymStatus === 'pending' ? 'Pending' : gymStatus ?? 'Live'}</div>
        </header>
        {banner && (
          <div style={{ background: banner.bg, borderBottom: `1px solid ${banner.border}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <AlertTriangle size={15} color={banner.text} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: banner.text, flex: 1 }}>{banner.msg}</span>
            {gymStatus === 'pending' && (
              <Link href="/kyc" style={{ fontSize: 12, color: banner.text, fontWeight: 700, textDecoration: 'underline', whiteSpace: 'nowrap' }}>
                Complete KYC →
              </Link>
            )}
          </div>
        )}
        <div className="flex-1 p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
