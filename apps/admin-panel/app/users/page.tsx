'use client';
import { useCallback, useEffect, useState } from 'react';
import Shell from '../../components/Shell';
import { Users, UserCheck, UserX, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import Pagination from '../../components/Pagination';
import { useToast } from '../../components/Toast';

type User = {
  id: string; name: string; phone: string; email: string;
  role: string; isActive: boolean; createdAt: string;
  subscriptionStatus?: string;
};

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, React.CSSProperties> = {
    super_admin: { background: 'rgba(180,120,255,0.18)', color: '#B478FF' },
    gym_owner: { background: 'rgba(255,180,0,0.15)', color: '#FFB400' },
    end_user: { background: 'rgba(100,160,255,0.15)', color: '#64A0FF' },
  };
  const s = styles[role] || styles['end_user'];
  return (
    <span style={{ ...s, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
      {role.replace('_', ' ')}
    </span>
  );
}

function SubStatusBadge({ status }: { status?: string }) {
  if (!status) return <span style={{ color: 'var(--t3)', fontSize: 12 }}>—</span>;
  const cls: Record<string, string> = { active: 'badge-active', expired: 'badge-danger', trial: 'badge-pending', none: '' };
  return <span className={cls[status] || 'badge-pending'}>{status}</span>;
}

function SkeletonRow() {
  return (
    <tr style={{ opacity: 0.4 }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i}><div style={{ height: 14, borderRadius: 6, background: 'rgba(255,255,255,0.08)', animation: 'pulse 1.5s ease-in-out infinite' }} /></td>
      ))}
    </tr>
  );
}

export default function UsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get<any>(`/users?page=${page}&limit=${limit}${q ? `&search=${encodeURIComponent(q)}` : ''}`);
      const rows: User[] = Array.isArray(res) ? res : (res as any)?.data ?? [];
      setUsers(rows);
      setTotal((res as any)?.total ?? rows.length);
      setPages((res as any)?.pages ?? 1);
    } catch (e: any) {
      setUsers([]);
      setTotal(0);
      setPages(1);
      setError('Failed to load users');
    } finally { setLoading(false); }
  }, [page, limit, q]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [q]);

  const suspendUser = async (id: string) => {
    try {
      await api.post(`/users/${id}/suspend`);
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, isActive: false } : u));
      toast('User suspended');
    } catch (e: any) {
      toast(e.message || 'Failed to suspend user', 'error');
    }
  };
  const unsuspendUser = async (id: string) => {
    try {
      await api.post(`/users/${id}/unsuspend`);
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, isActive: true } : u));
      toast('User restored');
    } catch (e: any) {
      toast(e.message || 'Failed to restore user', 'error');
    }
  };

  const filtered = users;
  const stats = {
    total: total || users.length,
    active: users.filter((u) => u.isActive).length,
    suspended: users.filter((u) => !u.isActive).length,
  };

  return (
    <Shell title="Users">
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      {error && (
        <div className="card p-3 mb-4 text-xs" style={{ color: '#FFB400', borderColor: 'rgba(255,180,0,0.3)', background: 'rgba(255,180,0,0.05)' }}>
          <AlertTriangle size={12} style={{ display:"inline", verticalAlign:"middle", marginRight:4 }} /> {error}
        </div>
      )}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Users', value: stats.total, icon: Users },
          { label: 'Active', value: stats.active, icon: UserCheck },
          { label: 'Suspended', value: stats.suspended, icon: UserX },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card stat-glow p-5">
              <div className="flex items-center gap-3 mb-2">
                <Icon size={16} style={{ color: 'var(--accent)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--t2)' }}>{s.label}</span>
              </div>
              <div className="text-2xl font-bold">{s.value}</div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mb-5">
        <input value={q} onChange={(e) => setQ(e.target.value)} className="glass-input flex-1"
          placeholder="Search by name, phone, or email..." />
      </div>

      <div className="glass overflow-hidden">
        <table className="glass-table">
          <thead>
            <tr>
              <th>Name</th><th>Phone</th><th>Role</th><th>Subscription</th>
              <th>Status</th><th>Created</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : filtered.length === 0
                ? <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--t2)', padding: '40px 0' }}>No users found</td></tr>
                : filtered.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#fff' }}>{u.name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--t3)' }}>{u.email || ''}</div>
                    </td>
                    <td>{u.phone}</td>
                    <td><RoleBadge role={u.role} /></td>
                    <td><SubStatusBadge status={u.subscriptionStatus} /></td>
                    <td><span className={u.isActive ? 'badge-active' : 'badge-danger'}>{u.isActive ? 'Active' : 'Suspended'}</span></td>
                    <td style={{ color: 'var(--t2)', fontSize: 12 }}>
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td>
                      {u.isActive ? (
                        <button onClick={() => suspendUser(u.id)}
                          className="btn text-xs" style={{ padding: '4px 10px', fontSize: 11, background: 'rgba(255,60,60,0.15)', color: '#FF3C3C', border: '1px solid rgba(255,60,60,0.3)' }}>
                          Suspend
                        </button>
                      ) : (
                        <button onClick={() => unsuspendUser(u.id)}
                          className="btn text-xs" style={{ padding: '4px 10px', fontSize: 11, background: 'rgba(61,255,84,0.1)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
                          Restore
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={pages} total={total} limit={limit} onPage={setPage} onLimit={(l) => { setLimit(l); setPage(1); }} />
    </Shell>
  );
}
