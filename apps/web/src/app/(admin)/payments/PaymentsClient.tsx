'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface RefundDto {
  id: string;
  amountCents: number;
  status: string;
}

interface PaymentDto {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
  stripePaymentIntentId: string | null;
  user: { id: string; name: string; email: string };
  refunds: RefundDto[];
  bookings: { session: { class: { title: string } } }[];
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#d69e2e',
  SUCCEEDED: '#38a169',
  FAILED: '#e53e3e',
  REFUNDED: '#3182ce',
  PARTIALLY_REFUNDED: '#805ad5',
};

export default function PaymentsClient({ initialPayments }: { initialPayments: PaymentDto[] }) {
  const router = useRouter();
  const [refundModal, setRefundModal] = useState<{ paymentId: string; max: number } | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefund() {
    if (!refundModal) return;
    const cents = Math.round(parseFloat(refundAmount) * 100);
    if (!cents || cents <= 0 || cents > refundModal.max) {
      setError(`Enter an amount between $0.01 and $${(refundModal.max / 100).toFixed(2)}`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/admin/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paymentId: refundModal.paymentId, amountCents: cents, reason: refundReason || 'Admin manual refund' }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? 'Refund failed');
      }
      setRefundModal(null);
      setRefundAmount('');
      setRefundReason('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {error && <p style={{ color: '#e53e3e', fontSize: '14px', marginBottom: '12px' }}>{error}</p>}

      {initialPayments.length === 0 ? (
        <p style={{ color: '#888' }}>No payments found.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              {['Customer', 'Class', 'Amount', 'Status', 'Date', 'Refunded', ''].map((h) => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#555' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {initialPayments.map((p) => {
              const totalRefunded = p.refunds.reduce((s, r) => (r.status === 'SUCCEEDED' ? s + r.amountCents : s), 0);
              const className = p.bookings[0]?.session?.class?.title ?? '—';
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <p style={{ margin: 0, fontWeight: 500 }}>{p.user.name}</p>
                    <p style={{ margin: 0, color: '#888', fontSize: '12px' }}>{p.user.email}</p>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#555', fontSize: '13px' }}>{className}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                    ${(p.amountCents / 100).toFixed(2)} {p.currency}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 600,
                      backgroundColor: (STATUS_COLOR[p.status] ?? '#718096') + '22',
                      color: STATUS_COLOR[p.status] ?? '#718096',
                    }}>
                      {p.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#666', fontSize: '13px' }}>
                    {new Date(p.createdAt).toLocaleDateString('en-AU')}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#555', fontSize: '13px' }}>
                    {totalRefunded > 0 ? `$${(totalRefunded / 100).toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    {['SUCCEEDED', 'PARTIALLY_REFUNDED'].includes(p.status) && p.stripePaymentIntentId && (
                      <button
                        onClick={() => { setRefundModal({ paymentId: p.id, max: p.amountCents - totalRefunded }); setError(null); }}
                        style={{ padding: '3px 10px', fontSize: '12px', backgroundColor: '#3182ce', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Refund
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Refund modal */}
      {refundModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '28px', width: '360px', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '16px', margin: '0 0 16px' }}>Issue Refund</h3>
            <p style={{ color: '#555', fontSize: '13px', margin: '0 0 16px' }}>
              Max refundable: ${(refundModal.max / 100).toFixed(2)}
            </p>
            {error && <p style={{ color: '#e53e3e', fontSize: '13px', marginBottom: '8px' }}>{error}</p>}
            <label style={{ display: 'block', fontSize: '12px', color: '#555', marginBottom: '4px' }}>Amount ($) *</label>
            <input
              type="number"
              step="0.01"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '100%', fontSize: '14px', marginBottom: '12px' }}
            />
            <label style={{ display: 'block', fontSize: '12px', color: '#555', marginBottom: '4px' }}>Reason</label>
            <input
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Admin manual refund"
              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '100%', fontSize: '14px', marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => void handleRefund()}
                disabled={loading}
                style={{ flex: 1, padding: '9px', backgroundColor: '#3182ce', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
              >
                {loading ? 'Processing…' : 'Confirm Refund'}
              </button>
              <button
                onClick={() => { setRefundModal(null); setError(null); }}
                disabled={loading}
                style={{ flex: 1, padding: '9px', backgroundColor: '#fff', color: '#333', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
