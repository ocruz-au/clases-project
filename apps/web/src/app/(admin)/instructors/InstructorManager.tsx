'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface InstructorDto {
  id: string;
  bio: string;
  deletedAt: string | null;
  user: { id: string; name: string; email: string };
}

export default function InstructorManager({ initialInstructors }: { initialInstructors: InstructorDto[] }) {
  const router = useRouter();
  const [instructors, setInstructors] = useState(initialInstructors);
  const [form, setForm] = useState({ userId: '', bio: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!form.userId.trim()) { setError('User ID is required'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/admin/instructors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? 'Failed to create');
      }
      const created = await res.json() as InstructorDto;
      setInstructors((prev) => [...prev, created]);
      setForm({ userId: '', bio: '' });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivate(id: string) {
    try {
      await fetch(`/api/v1/admin/instructors/${id}`, { method: 'DELETE', credentials: 'include' });
      setInstructors((prev) => prev.filter((i) => i.id !== id));
      router.refresh();
    } catch {
      setError('Deactivation failed');
    }
  }

  return (
    <div>
      {error && <p style={{ color: '#e53e3e', fontSize: '14px', marginBottom: '12px' }}>{error}</p>}

      {/* Add form */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap', padding: '16px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#555', marginBottom: '4px' }}>User ID (UUID)</label>
          <input value={form.userId} onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
            placeholder="Paste user UUID…"
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '100%', fontSize: '13px' }} />
        </div>
        <div style={{ flex: 2, minWidth: '200px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#555', marginBottom: '4px' }}>Bio</label>
          <input value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            placeholder="Short bio…"
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '100%', fontSize: '13px' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button onClick={() => void handleCreate()} disabled={loading}
            style={{ padding: '8px 16px', backgroundColor: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            {loading ? '…' : 'Add Instructor'}
          </button>
        </div>
      </div>

      {/* List */}
      {instructors.length === 0 ? (
        <p style={{ color: '#888' }}>No instructors yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#555' }}>Name</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#555' }}>Email</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#555' }}>Bio</th>
              <th style={{ padding: '12px 16px' }} />
            </tr>
          </thead>
          <tbody>
            {instructors.map((i) => (
              <tr key={i.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{i.user.name}</td>
                <td style={{ padding: '12px 16px', color: '#666' }}>{i.user.email}</td>
                <td style={{ padding: '12px 16px', color: '#666', maxWidth: '240px' }}>{i.bio || '—'}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <button onClick={() => void handleDeactivate(i.id)}
                    style={{ padding: '3px 10px', fontSize: '12px', backgroundColor: '#718096', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Deactivate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
