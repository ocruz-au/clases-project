'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserDto {
  id: string;
  email: string;
  name: string;
  status: string;
  deletedAt: string | null;
  userRoles: { role: { key: string } }[];
}

const ROLE_KEYS = ['STUDENT', 'INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'];

export default function UserManager({ initialUsers }: { initialUsers: UserDto[] }) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAssignRole(userId: string, roleKey: string) {
    setLoading(`role-${userId}`);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ roleKey }),
      });
      if (!res.ok) throw new Error('Failed to assign role');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(null);
    }
  }

  async function handleDeactivate(userId: string) {
    if (!confirm('Deactivate this user? They will lose access immediately.')) return;
    setLoading(`del-${userId}`);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to deactivate');
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      {error && <p style={{ color: '#e53e3e', fontSize: '14px', marginBottom: '12px' }}>{error}</p>}

      {users.length === 0 ? (
        <p style={{ color: '#888' }}>No users found.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#555' }}>Name</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#555' }}>Email</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#555' }}>Roles</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#555' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#555' }}>Assign Role</th>
              <th style={{ padding: '12px 16px' }} />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const currentRoles = u.userRoles.map((r) => r.role.key);
              return (
                <tr key={u.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>{u.name}</td>
                  <td style={{ padding: '12px 16px', color: '#666' }}>{u.email}</td>
                  <td style={{ padding: '12px 16px', color: '#555' }}>
                    {currentRoles.join(', ') || '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '10px', fontSize: '12px',
                      backgroundColor: u.status === 'ACTIVE' ? '#f0fff4' : '#fff5f5',
                      color: u.status === 'ACTIVE' ? '#276749' : '#c53030',
                    }}>
                      {u.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <select
                      onChange={(e) => { if (e.target.value) void handleAssignRole(u.id, e.target.value); }}
                      defaultValue=""
                      disabled={loading === `role-${u.id}`}
                      style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ddd' }}
                    >
                      <option value="">+ Role</option>
                      {ROLE_KEYS.filter((r) => !currentRoles.includes(r)).map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    {u.status !== 'DISABLED' && (
                      <button
                        onClick={() => void handleDeactivate(u.id)}
                        disabled={loading === `del-${u.id}`}
                        style={{ padding: '3px 10px', fontSize: '12px', backgroundColor: '#718096', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
