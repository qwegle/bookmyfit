'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '../../components/Shell';
import { api } from '../../lib/api';
import { Building2, ListChecks, Sparkles } from 'lucide-react';

type PassCommission = { mode?: 'percent' | 'fixed'; value?: number };

function asArray(value: any) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.partners)) return value.partners;
  return [];
}

function formatMoney(value: any) {
  if (value == null || value === '') return 'Unavailable';
  const amount = Math.round(Number(value) || 0);
  return `Rs ${amount.toLocaleString('en-IN')}`;
}

function formatCommission(value: PassCommission | undefined) {
  const amount = Math.max(0, Number(value?.value) || 0);
  if (!amount) return '0';
  return value?.mode === 'fixed' ? formatMoney(amount) : `${amount}%`;
}

function avg(values: number[]) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return null;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

export default function CommissionPage() {
  const [plans, setPlans] = useState<any>(null);
  const [gyms, setGyms] = useState<any[]>([]);
  const [wellnessPartners, setWellnessPartners] = useState<any[]>([]);
  const [availability, setAvailability] = useState({ plans: false, gyms: false, wellness: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    Promise.all([
      api.get('/subscriptions/plans').catch(() => null),
      api.get('/gyms?limit=200').catch(() => null),
      api.get('/wellness/admin/partners').catch(() => null),
    ]).then(([planRes, gymRes, wellnessRes]) => {
      if (!alive) return;
      setPlans(planRes || null);
      setGyms(asArray(gymRes));
      setWellnessPartners(asArray(wellnessRes));
      setAvailability({ plans: Boolean(planRes), gyms: Boolean(gymRes), wellness: Boolean(wellnessRes) });
    }).finally(() => {
      if (alive) setLoading(false);
    });

    return () => { alive = false; };
  }, []);

  const gymAvg = avg(gyms.map((gym) => Number(gym.commissionRate)));
  const wellnessAvg = avg(wellnessPartners.map((partner) => Number(partner.commissionRate)));

  const cards = [
    {
      label: 'Same Gym Checkout Add-on',
      value: loading ? '...' : !availability.plans ? 'Unavailable' : formatCommission(plans?.same_gym?.commission),
      detail: 'Added above each gym plan price at checkout',
      href: '/plans',
      icon: ListChecks,
    },
    {
      label: 'Day Pass Checkout Add-on',
      value: loading ? '...' : !availability.plans ? 'Unavailable' : `${formatMoney(plans?.day_pass?.basePrice)} + ${formatCommission(plans?.day_pass?.commission)}`,
      detail: 'Base day-pass price plus admin add-on',
      href: '/plans',
      icon: ListChecks,
    },
    {
      label: 'Gym Revenue Share',
      value: loading ? '...' : !availability.gyms ? 'Unavailable' : gymAvg == null ? 'Not set' : `${gymAvg.toFixed(1)}% avg`,
      detail: availability.gyms ? `${gyms.length} gyms loaded from database` : 'Gyms API did not return data',
      href: '/tiers',
      icon: Building2,
    },
    {
      label: 'Wellness Commission',
      value: loading ? '...' : !availability.wellness ? 'Unavailable' : wellnessAvg == null ? 'Not set' : `${wellnessAvg.toFixed(1)}% avg`,
      detail: availability.wellness ? `${wellnessPartners.length} partners loaded from database` : 'Wellness API did not return data',
      href: '/wellness',
      icon: Sparkles,
    },
  ];

  return (
    <Shell title="Commission Overview">
      <div style={{ marginBottom: 28 }}>
        <h1 className="serif" style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>Commission Overview</h1>
        <p style={{ color: 'var(--t2)', fontSize: 14, maxWidth: 780 }}>
          This page reads the live commission sources used by checkout, settlements, gym revenue share, and wellness bookings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} href={card.href} className="card stat-glow p-5 block transition hover:bg-white/5">
              <div className="flex items-center justify-between mb-4">
                <Icon size={18} style={{ color: 'var(--accent)' }} />
                <span className="accent-pill text-[10px]">Open</span>
              </div>
              <div className="text-2xl font-bold mb-1">{card.value}</div>
              <div className="text-xs mb-2" style={{ color: 'var(--t2)' }}>{card.label}</div>
              <div className="text-[11px]" style={{ color: 'var(--t3)' }}>{card.detail}</div>
            </Link>
          );
        })}
      </div>

      <div className="glass p-6">
        <h3 className="serif text-lg mb-4">Source Mapping</h3>
        <table className="glass-table">
          <thead>
            <tr><th>Area</th><th>Managed From</th><th>Used For</th><th></th></tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-semibold text-white">Same Gym and Day Pass checkout</td>
              <td>Plan Management</td>
              <td>Final user payment amount before Cashfree order creation</td>
              <td><Link className="btn btn-ghost text-xs" href="/plans">Open</Link></td>
            </tr>
            <tr>
              <td className="font-semibold text-white">Per-gym revenue share</td>
              <td>Tier Management / Gym Management</td>
              <td>Gym settlements, scanner earnings, check-in revenue split</td>
              <td><Link className="btn btn-ghost text-xs" href="/tiers">Open</Link></td>
            </tr>
            <tr>
              <td className="font-semibold text-white">Wellness partner commission</td>
              <td>Wellness Services</td>
              <td>Wellness booking commission and partner net earnings</td>
              <td><Link className="btn btn-ghost text-xs" href="/wellness">Open</Link></td>
            </tr>
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
