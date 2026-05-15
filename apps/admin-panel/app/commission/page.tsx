'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '../../components/Shell';
import { api } from '../../lib/api';
import { ListChecks } from 'lucide-react';

type PassCommission = { mode?: 'percent' | 'fixed'; value?: number };

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

export default function CommissionPage() {
  const [plans, setPlans] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.get('/subscriptions/plans')
      .then((planRes) => { if (alive) setPlans(planRes || null); })
      .catch(() => { if (alive) setPlans(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const available = Boolean(plans);
  const cards = [
    {
      label: 'Global Checkout Add-on',
      value: loading ? '...' : !available ? 'Unavailable' : formatCommission(plans?.globalCommission),
      detail: 'Default add-on for every service that inherits global',
    },
    {
      label: 'Same Gym Checkout',
      value: loading ? '...' : !available ? 'Unavailable' : formatCommission(plans?.same_gym?.commission),
      detail: 'Added above each gym-owned plan price',
    },
    {
      label: 'Day Pass Checkout',
      value: loading ? '...' : !available ? 'Unavailable' : `${formatMoney(plans?.day_pass?.basePrice)} + ${formatCommission(plans?.day_pass?.commission)}`,
      detail: 'Base day-pass amount plus configured add-on',
    },
    {
      label: 'Multi Gym Checkout',
      value: loading ? '...' : !available ? 'Unavailable' : `${formatMoney(plans?.multi_gym?.basePrice)} / mo`,
      detail: 'Platform-set pass price. No checkout commission is added.',
    },
    {
      label: 'Wellness Checkout',
      value: loading ? '...' : !available ? 'Unavailable' : formatCommission(plans?.wellness?.commission),
      detail: 'Applied to wellness booking checkout',
    },
    {
      label: 'Personal Training Checkout',
      value: loading ? '...' : !available ? 'Unavailable' : formatCommission(plans?.personal_training?.commission),
      detail: 'Applied to trainer bookings and PT add-ons',
    },
  ];

  return (
    <Shell title="Commission Overview">
      <div style={{ marginBottom: 28 }}>
        <h1 className="serif" style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>Commission Overview</h1>
        <p style={{ color: 'var(--t2)', fontSize: 14, maxWidth: 780 }}>
          These values come from Plan Management. Set one global commission, then override specific services only when needed.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {cards.map((card) => (
          <Link key={card.label} href="/plans" className="card stat-glow p-5 block transition hover:bg-white/5">
            <div className="flex items-center justify-between mb-4">
              <ListChecks size={18} style={{ color: 'var(--accent)' }} />
              <span className="accent-pill text-[10px]">Plan Management</span>
            </div>
            <div className="text-2xl font-bold mb-1">{card.value}</div>
            <div className="text-xs mb-2" style={{ color: 'var(--t2)' }}>{card.label}</div>
            <div className="text-[11px]" style={{ color: 'var(--t3)' }}>{card.detail}</div>
          </Link>
        ))}
      </div>

      <div className="glass p-6">
        <h3 className="serif text-lg mb-4">Source Mapping</h3>
        <table className="glass-table">
          <thead>
            <tr><th>Area</th><th>Managed From</th><th>Used For</th><th></th></tr>
          </thead>
          <tbody>
            {['Same Gym', 'Day Pass', 'Wellness', 'Personal Training'].map((area) => (
              <tr key={area}>
                <td className="font-semibold text-white">{area}</td>
                <td>Plan Management</td>
                <td>Final user checkout amount and platform add-on calculation</td>
                <td><Link className="btn btn-ghost text-xs" href="/plans">Open</Link></td>
              </tr>
            ))}
            <tr>
              <td className="font-semibold text-white">Multi Gym</td>
              <td>Plan Management</td>
              <td>Base monthly pass price only, without additional checkout commission</td>
              <td><Link className="btn btn-ghost text-xs" href="/plans">Open</Link></td>
            </tr>
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
