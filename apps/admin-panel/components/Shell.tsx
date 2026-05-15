'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, BarChart3, Building2, Users, CreditCard, Briefcase, UserCheck, Calendar,
  DollarSign, Percent, Home as HomeIcon, Package, Tags, Bell, Settings, ShieldAlert, LogOut,
  ShieldCheck, Star, Award, ClipboardCheck, ListChecks, Sparkles, Activity,
} from 'lucide-react';

const NAV = [
  { group: 'Overview', items: [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  ]},
  { group: 'Management', items: [
    { href: '/gyms', label: 'Gym Management', icon: Building2 },
    { href: '/kyc', label: 'KYC Review', icon: ShieldCheck },
    { href: '/tiers', label: 'Tier Management', icon: Award },
    { href: '/users', label: 'Users', icon: Users },
    { href: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
    { href: '/plans', label: 'Plan Management', icon: ListChecks },
    { href: '/wellness', label: 'Wellness Services', icon: Sparkles },
    { href: '/corporate', label: 'Corporate', icon: Briefcase },
    { href: '/corporate/employees', label: 'Corporate Employees', icon: UserCheck },
    { href: '/bookings', label: 'Bookings', icon: Calendar },
    { href: '/checkins', label: 'Check-in Records', icon: Activity },
    { href: '/attendance', label: 'Attendance', icon: ClipboardCheck },
  ]},
  { group: 'Revenue', items: [
    { href: '/settlements', label: 'Settlements', icon: DollarSign },
    { href: '/commission', label: 'Commission Overview', icon: Percent },
  ]},
  { group: 'Content', items: [
    { href: '/homepage', label: 'Homepage Builder', icon: HomeIcon },
    { href: '/store', label: 'Store Products', icon: Package },
    { href: '/categories', label: 'Categories & Amenities', icon: Tags },
  ]},
  { group: 'Platform', items: [
    { href: '/ratings', label: 'Ratings', icon: Star },
  ]},
  { group: 'System', items: [
    { href: '/notifications', label: 'Push Notifications', icon: Bell },
    { href: '/fraud', label: 'Fraud Monitoring', icon: ShieldAlert },
    { href: '/settings', label: 'Settings', icon: Settings },
  ]},
];

export default function Shell({ children, title }: { children: React.ReactNode; title: string }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen text-white">
      <aside className="w-[280px] border-r flex flex-col" style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="serif flex items-center gap-2" style={{ fontSize: 21, fontWeight: 900, letterSpacing: '-0.7px' }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--accent)', boxShadow: '0 0 18px rgba(61,255,84,0.75)' }} />
            Book<em style={{ fontStyle: 'italic', fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>My</em>Fit
          </div>
          <div className="kicker mt-1" style={{ color: 'var(--accent)', opacity: 0.7 }}>Admin Console</div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {NAV.map((group) => (
            <div key={group.group} className="mb-4">
              <div className="px-5 mb-2 kicker" style={{ color: 'rgba(255,255,255,0.34)' }}>{group.group}</div>
              {group.items.map((item) => {
                const active = pathname === item.href || (item.href !== '/' && pathname?.startsWith(`${item.href}/`));
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}
                    className="mx-3 mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition hover:bg-white/5"
                    style={{
                      color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                      background: active ? 'rgba(61,255,84,0.10)' : 'transparent',
                      border: active ? '1px solid rgba(61,255,84,0.24)' : '1px solid transparent',
                      fontWeight: active ? 600 : 400,
                    }}>
                    <Icon size={15} strokeWidth={1.8} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="p-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => { localStorage.removeItem('bmf_admin_token'); localStorage.removeItem('bmf_admin_user'); window.location.href = '/login'; }}
            className="flex items-center gap-2 text-[12px] w-full px-3 py-2 rounded-lg transition hover:bg-red-500/10"
            style={{ color: 'rgba(255,100,100,0.8)' }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col">
        <header className="h-16 border-b px-8 flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(16px)' }}>
          <h1 className="serif" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px' }}>{title}</h1>
          <div className="accent-pill">Super Admin</div>
        </header>
        <div className="flex-1 p-8">{children}</div>
      </main>
    </div>
  );
}
