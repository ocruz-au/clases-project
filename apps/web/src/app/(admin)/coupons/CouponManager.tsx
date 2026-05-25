'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CouponDto {
  id: string;
  code: string;
  type: string;
  value: number;
  validFrom: string;
  validUntil: string;
  maxRedemptions: number | null;
  redeemedCount: number;
  deletedAt: string | null;
}

export default function CouponManager({ initialCoupons }: { initialCoupons: CouponDto[] }) {
  const router = useRouter();
  const [coupons, setCoupons] = useState(initialCoupons);
  const [form, setForm] = useState({
    code: '',
    type: 'PERCENT' as 'PERCENT' | 'FIXED',
    value: '',
    validFrom: '',
    validUntil: '',
    maxRedemptions: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!form.code || !form.value || !form.validFrom || !form.validUntil) {
      setError('Code, value, validFrom and validUntil are required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code: form.code.toUpperCase(),
          type: form.type,
          value: parseInt(form.value, 10),
          validFrom: new Date(form.validFrom).toISOString(),
          validUntil: new Date(form.validUntil).toISOString(),
          maxRedemptions: form.maxRedemptions ? parseInt(form.maxRedemptions, 10) : null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? 'Failed to create coupon');
      }
      const created = await res.json() as CouponDto;
      setCoupons((prev) => [created, ...prev]);
      setForm({ code: '', type: 'PERCENT', value: '', validFrom: '', validUntil: '', maxRedemptions: '' });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivate(id: string) {
    try {
      await fetch(`/api/v1/admin/coupons/${id}`, { method: 'DELETE', credentials: 'include' });
      setCoupons((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    } catch {
      setError('Deactivation failed');
    }
  }

  const inputStyle = { padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '100%', fontSize: '13px' };
  const labelStyle = { display: 'block', fontSize: '12px', color: '#555', marginBottom: '4px' };

  return (
    <div>
      {error && <p style={{ color: '#e53e3e', fontSize: '14px', marginBottom: '12px' }}>{error}</p>}

      {/* Create form */}
      <div style={{ padding: '16px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', margin: '0 0 16px', fontWeight: 600 }}>New Coupon</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Code *</label>
            <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="SAVE20" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Type *</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'PERCENT' | 'FIXED' }))} style={inputStyle}>
              <option value="PERCENT">Percent (%)</option>
              <option value="FIXED">Fixed (¢)</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Value * {form.type === 'PERCENT' ? '(%)' : '(cents)'}</label>
            <input type="number" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} placeholder={form.type === 'PERCENT' ? '20' : '500'} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Valid from *</label>
            <input type="date" value={form.validFrom} onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Valid until *</label>
            <input type="date" value={form.validUntil} onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Max redemptions</label>
            <input type="number" value={form.maxRedemptions} onChange={(e) => setForm((f) => ({ ...f, maxRedemptions: e.target.value }))} placeholder="Unlimited" style={inputStyle} />
          </div>
        </div>
        <button
          onClick={() => void handleCreate()}
          disabled={loading}
          style={{ marginTop: '16px', padding: '8px 20px', backgroundColor: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
        >
          {loading ? '…' : 'Create Coupon'}
        </button>
      </div>

      {/* Table */}
      {coupons.length === 0 ? (
        <p style={{ color: '#888' }}>No coupons yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              {['Code', 'Type', 'Value', 'Valid from', 'Valid until', 'Redeemed', ''].map((h) => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#555' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{c.code}</td>
                <td style={{ padding: '12px 16px', color: '#555' }}>{c.type}</td>
                <td style={{ padding: '12px 16px' }}>{c.type === 'PERCENT' ? `${c.value}%` : `$${(c.value / 100).toFixed(2)}`}</td>
                <td style={{ padding: '12px 16px', color: '#666', fontSize: '13px' }}>{new Date(c.validFrom).toLocaleDateString('en-AU')}</td>
                <td style={{ padding: '12px 16px', color: '#666', fontSize: '13px' }}>{new Date(c.validUntil).toLocaleDateString('en-AU')}</td>
                <td style={{ padding: '12px 16px', color: '#555' }}>
                  {c.redeemedCount}{c.maxRedemptions !== null ? ` / ${c.maxRedemptions}` : ' / ∞'}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <button
                    onClick={() => void handleDeactivate(c.id)}
                    style={{ padding: '3px 10px', fontSize: '12px', backgroundColor: '#718096', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
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
