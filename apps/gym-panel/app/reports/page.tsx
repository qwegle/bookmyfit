'use client';

import Shell from '../../components/Shell';
import { api } from '../../lib/api';
import { useEffect, useState } from 'react';
import { BarChart2, Download, Users, Activity, Clock, TrendingUp, AlertTriangle } from 'lucide-react';

const EMPTY_REPORT = {
  totalCheckins: 0,
  uniqueMembers: 0,
  subscriberCount: 0,
  activeSubscribers: 0,
  peakHour: '--',
  revenueShare: 0,
  lifetimeGymEarned: 0,
  subscriptionRevenue: 0,
  trainerRevenue: 0,
  multiGymRevenue: 0,
  trainerAddonsCount: 0,
  dailyCheckins: [] as { day: string; count: number }[],
  topMembers: [] as { id: string; name: string; visits: number; plan: string; lastVisit: string }[],
};

type Period = 'week' | 'month' | 'last_month' | 'custom';

interface ReportData {
  totalCheckins: number;
  uniqueMembers: number;
  subscriberCount?: number;
  activeSubscribers?: number;
  peakHour: string;
  revenueShare: number;
  lifetimeGymEarned?: number;
  subscriptionRevenue?: number;
  trainerRevenue?: number;
  multiGymRevenue?: number;
  trainerAddonsCount?: number;
  dailyCheckins: { day: string; count: number }[];
  topMembers: { id: string; name: string; visits: number; plan: string; lastVisit: string }[];
}

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, React.CSSProperties> = {
    Elite: { background: 'rgba(180,120,255,0.18)', color: '#B478FF' },
    Pro: { background: 'rgba(255,180,0,0.15)', color: '#FFB400' },
    Max: { background: 'rgba(255,100,60,0.15)', color: '#FF6432' },
    Individual: { background: 'rgba(100,160,255,0.15)', color: '#64A0FF' },
  };
  const s = colors[plan] || { background: 'rgba(255,255,255,0.08)', color: 'var(--t)' };
  return (
    <span style={{ ...s, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
      {plan}
    </span>
  );
}

function SkeletonKPI() {
  return (
    <div className="card p-5" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
      <div style={{ height: 12, width: '60%', background: 'var(--surface)', borderRadius: 6, marginBottom: 12 }} />
      <div style={{ height: 28, width: '40%', background: 'var(--surface)', borderRadius: 6 }} />
    </div>
  );
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ReportData | null>(null);

  useEffect(() => {
    setLoading(true);
    const now = new Date();
    const fromDate = new Date(now);
    const toDate = new Date(now);
    if (period === 'week') fromDate.setDate(now.getDate() - 6);
    if (period === 'month') fromDate.setDate(now.getDate() - 29);
    if (period === 'last_month') {
      fromDate.setMonth(now.getMonth() - 1, 1);
      toDate.setDate(0);
    }
    const from = period === 'custom' ? customFrom : fromDate.toISOString().slice(0, 10);
    const to = period === 'custom' ? customTo : toDate.toISOString().slice(0, 10);
    const query = from && to ? `?from=${from}&to=${to}` : '';
    api.get<ReportData>(`/gyms/my-report${query}`)
      .then((data) => setReport(data || EMPTY_REPORT))
      .catch(() => setReport(EMPTY_REPORT))
      .finally(() => setLoading(false));
  }, [period, customFrom, customTo]);

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'last_month', label: 'Last Month' },
    { key: 'custom', label: 'Custom' },
  ];

  function exportCSV() {
    if (!report) return;
    const csv = [
      'Name,Visits,Plan,Last Visit',
      ...report.topMembers.map((m) => `"${m.name}",${m.visits},"${m.plan}","${m.lastVisit}"`),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gym-report-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const maxVal = report?.dailyCheckins.length ? Math.max(...report.dailyCheckins.map((d) => d.count), 1) : 1;

  return (
    <Shell title="Reports">
      {/* Period Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {PERIODS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={period === key ? 'btn' : 'btn glass-input'}
            style={
              period === key
                ? { background: 'var(--accent)', color: '#000', fontWeight: 700, border: 'none' }
                : { border: '1px solid var(--border)', fontWeight: 500 }
            }
          >
            {label}
          </button>
        ))}
        {period === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="glass-input"
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--t)', fontSize: 13 }}
            />
            <span style={{ color: 'var(--t3)', fontSize: 13 }}>to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="glass-input"
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--t)', fontSize: 13 }}
            />
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16, marginBottom: 24 }}>
        {loading ? (
          [0, 1, 2, 3].map((i) => <SkeletonKPI key={i} />)
        ) : (
          <>
            <div className="card stat-glow" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Activity size={16} style={{ color: 'var(--accent)' }} />
                <span className="kicker" style={{ color: 'var(--t2)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Check-ins</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--t)' }}>{report?.totalCheckins}</div>
            </div>
            <div className="card stat-glow" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Users size={16} style={{ color: 'var(--accent)' }} />
                <span className="kicker" style={{ color: 'var(--t2)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Subscribers</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--t)' }}>{report?.activeSubscribers ?? 0}/{report?.subscriberCount ?? 0}</div>
            </div>
            <div className="card stat-glow" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Clock size={16} style={{ color: 'var(--accent)' }} />
                <span className="kicker" style={{ color: 'var(--t2)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Peak Hour</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--t)' }}>{report?.peakHour}</div>
            </div>
            <div className="card stat-glow" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <TrendingUp size={16} style={{ color: 'var(--accent)' }} />
                <span className="kicker" style={{ color: 'var(--t2)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Period Gym Amount</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--t)' }}>
                &#8377;{report?.revenueShare?.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="card stat-glow" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <TrendingUp size={16} style={{ color: 'var(--accent)' }} />
                <span className="kicker" style={{ color: 'var(--t2)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Till Date Earned</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--t)' }}>
                &#8377;{Number(report?.lifetimeGymEarned || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="card stat-glow" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Users size={16} style={{ color: 'var(--accent)' }} />
                <span className="kicker" style={{ color: 'var(--t2)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Trainer Add-ons</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--t)' }}>{report?.trainerAddonsCount ?? 0}</div>
              <div style={{ color: 'var(--t2)', fontSize: 12, marginTop: 4 }}>
                Rs {Number(report?.trainerRevenue || 0).toLocaleString('en-IN')}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bar Chart */}
      <div className="glass" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <BarChart2 size={18} style={{ color: 'var(--accent)' }} />
          <h3 className="serif" style={{ fontSize: 17, fontWeight: 600 }}>Check-ins by Day</h3>
        </div>
        {loading ? (
          <div style={{ height: 160, background: 'var(--surface)', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 160, paddingBottom: 24, position: 'relative' }}>
            {report?.dailyCheckins.map((d) => (
              <div key={d.day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <span style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 4, fontWeight: 500 }}>{d.count}</span>
                <div
                  style={{
                    background: 'var(--accent)',
                    opacity: 0.85,
                    minWidth: 32,
                    width: '100%',
                    height: `${(d.count / maxVal) * 140}px`,
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.4s ease',
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6, fontWeight: 500 }}>{d.day}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Members Table */}
      <div className="glass" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 className="serif" style={{ fontSize: 17, fontWeight: 600 }}>Top Members</h3>
          <button className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }} onClick={exportCSV}>
            <Download size={14} />
            Export CSV
          </button>
        </div>
        {loading ? (
          <div style={{ height: 200, background: 'var(--surface)', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
        ) : (
          <table className="glass-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Rank', 'Name', 'Visits', 'Plan Type', 'Last Visit'].map((col) => (
                  <th key={col} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report?.topMembers.map((member, idx) => (
                <tr key={member.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 12px', fontWeight: 700, fontSize: 15, color: idx < 3 ? 'var(--accent)' : 'var(--t2)' }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: '12px 12px', fontWeight: 600, color: 'var(--t)', fontSize: 14 }}>{member.name}</td>
                  <td style={{ padding: '12px 12px', color: 'var(--t)', fontSize: 14 }}>{member.visits}</td>
                  <td style={{ padding: '12px 12px' }}>
                    <PlanBadge plan={member.plan} />
                  </td>
                  <td style={{ padding: '12px 12px', color: 'var(--t2)', fontSize: 13 }}>{member.lastVisit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Shell>
  );
}
