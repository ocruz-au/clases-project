'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Category { id: string; name: string; slug: string; description?: string }
interface Location { id: string; name: string; address: string; timezone: string }

const TABS = ['Categories', 'Locations'] as const;
type Tab = (typeof TABS)[number];

function SectionTable({
  rows,
  columns,
  onDelete,
}: {
  rows: Record<string, string>[];
  columns: string[];
  onDelete: (id: string) => void;
}) {
  if (rows.length === 0) return <p style={{ color: '#888', fontSize: '14px' }}>No items yet.</p>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
      <thead>
        <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
          {columns.map((c) => (
            <th key={c} style={{ padding: '8px 12px', textAlign: 'left', color: '#555' }}>{c}</th>
          ))}
          <th style={{ padding: '8px 12px' }} />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row['id']} style={{ borderBottom: '1px solid #f0f0f0' }}>
            {columns.map((c) => (
              <td key={c} style={{ padding: '10px 12px' }}>{row[c.toLowerCase()] ?? row[c] ?? ''}</td>
            ))}
            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
              <button
                onClick={() => onDelete(row['id']!)}
                style={{ padding: '3px 10px', fontSize: '12px', backgroundColor: '#e53e3e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function CatalogClient({
  initialCategories,
  initialLocations,
}: {
  initialCategories: unknown[];
  initialLocations: unknown[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('Categories');
  const [categories, setCategories] = useState<Category[]>(initialCategories as Category[]);
  const [locations, setLocations] = useState<Location[]>(initialLocations as Location[]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apiCall(method: string, path: string, body?: unknown) {
    const res = await fetch(`/api/v1${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error((await res.json() as { message?: string }).message ?? 'Request failed');
    return res.json();
  }

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'Categories') {
        const cat = await apiCall('POST', '/admin/categories', form) as Category;
        setCategories((prev) => [...prev, cat]);
      } else {
        const loc = await apiCall('POST', '/admin/locations', form) as Location;
        setLocations((prev) => [...prev, loc]);
      }
      setForm({});
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      if (tab === 'Categories') {
        await apiCall('DELETE', `/admin/categories/${id}`);
        setCategories((prev) => prev.filter((c) => c.id !== id));
      } else {
        await apiCall('DELETE', `/admin/locations/${id}`);
        setLocations((prev) => prev.filter((l) => l.id !== id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  const tabStyle = (active: boolean) => ({
    padding: '8px 20px',
    borderBottom: active ? '2px solid #1a1a2e' : '2px solid transparent',
    color: active ? '#1a1a2e' : '#888',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    fontSize: '14px',
    fontWeight: active ? 600 : 400,
  } as React.CSSProperties);

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0', marginBottom: '24px' }}>
        {TABS.map((t) => (
          <button key={t} style={tabStyle(tab === t)} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {error && <p style={{ color: '#e53e3e', marginBottom: '12px', fontSize: '14px' }}>{error}</p>}

      {/* Create form */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {tab === 'Categories' ? (
          <>
            <input placeholder="Name" value={form['name'] ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', flex: 1, minWidth: '140px' }} />
            <input placeholder="Slug" value={form['slug'] ?? ''} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', flex: 1, minWidth: '100px' }} />
          </>
        ) : (
          <>
            <input placeholder="Name" value={form['name'] ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', flex: 1, minWidth: '140px' }} />
            <input placeholder="Address" value={form['address'] ?? ''} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', flex: 2, minWidth: '200px' }} />
          </>
        )}
        <button onClick={() => void handleCreate()} disabled={loading}
          style={{ padding: '8px 16px', backgroundColor: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          {loading ? '…' : 'Add'}
        </button>
      </div>

      {/* Table */}
      {tab === 'Categories' ? (
        <SectionTable
          rows={categories as unknown as Record<string, string>[]}
          columns={['Name', 'Slug']}
          onDelete={(id) => void handleDelete(id)}
        />
      ) : (
        <SectionTable
          rows={locations as unknown as Record<string, string>[]}
          columns={['Name', 'Address', 'Timezone']}
          onDelete={(id) => void handleDelete(id)}
        />
      )}
    </div>
  );
}
