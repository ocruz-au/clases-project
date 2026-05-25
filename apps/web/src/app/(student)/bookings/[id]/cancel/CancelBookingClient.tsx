'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DateTime } from 'luxon';

interface PolicyRule { hoursBefore: number; refundPercent: number }

interface BookingDetail {
  id: string;
  status: string;
  amountCents: number;
  session: {
    startsAt: string;
    class: {
      title: string;
      currency: string;
      cancellationPolicy?: { rules: PolicyRule[] } | null;
    };
    room: { name: string; location: { name: string } };
    cancellationPolicy?: { rules: PolicyRule[] } | null;
  };
}

function computeRefundPercent(rules: PolicyRule[], sessionStart: Date, now: Date): number {
  if (!rules.length) return 0;
  const hoursBefore = (sessionStart.getTime() - now.getTime()) / 3600_000;
  const sorted = [...rules].sort((a, b) => b.hoursBefore - a.hoursBefore);
  for (const rule of sorted) {
    if (hoursBefore >= rule.hoursBefore) return rule.refundPercent;
  }
  return 0;
}

export default function CancelBookingClient({ booking }: { booking: BookingDetail }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const sessionStart = new Date(booking.session.startsAt);
  const perthStart = DateTime.fromISO(booking.session.startsAt, { zone: 'Australia/Perth' });

  const rules =
    (booking.session.cancellationPolicy?.rules ??
      booking.session.class.cancellationPolicy?.rules ??
      null);

  const refundPercent = rules ? computeRefundPercent(rules, sessionStart, now) : 0;
  const refundAmountCents = Math.round((booking.amountCents * refundPercent) / 100);
  const currency = booking.session.class.currency ?? 'AUD';

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/bookings/${booking.id}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? 'Cancellation failed');
      }
      router.push('/bookings');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Booking summary */}
      <div
        style={{
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: '20px',
          backgroundColor: '#fff',
          marginBottom: '24px',
        }}
      >
        <h2 style={{ fontSize: '18px', margin: '0 0 8px' }}>{booking.session.class.title}</h2>
        <p style={{ color: '#555', margin: '0 0 4px', fontSize: '14px' }}>
          {perthStart.toFormat('EEEE, d MMMM yyyy')} at {perthStart.toFormat('h:mm a')} (Perth)
        </p>
        <p style={{ color: '#666', margin: '0', fontSize: '14px' }}>
          {booking.session.room.location.name} — {booking.session.room.name}
        </p>
        <p style={{ fontSize: '18px', fontWeight: 'bold', margin: '12px 0 0' }}>
          {new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(booking.amountCents / 100)}
        </p>
      </div>

      {/* Refund preview */}
      {refundPercent > 0 ? (
        <div
          style={{
            backgroundColor: '#f0fff4',
            border: '1px solid #9ae6b4',
            borderRadius: '6px',
            padding: '16px',
            marginBottom: '24px',
          }}
        >
          <p style={{ color: '#276749', margin: 0, fontWeight: 'bold' }}>
            Refund: {new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(refundAmountCents / 100)}{' '}
            ({refundPercent}%)
          </p>
          <p style={{ color: '#276749', margin: '6px 0 0', fontSize: '13px' }}>
            Your refund will be processed within 5–10 business days.
          </p>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: '#fff5f5',
            border: '1px solid #feb2b2',
            borderRadius: '6px',
            padding: '16px',
            marginBottom: '24px',
          }}
        >
          <p style={{ color: '#c53030', margin: 0 }}>
            No refund applies based on the current cancellation policy and time remaining.
          </p>
        </div>
      )}

      {error && (
        <p style={{ color: '#e53e3e', fontSize: '14px', marginBottom: '16px' }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => void handleConfirm()}
          disabled={loading}
          style={{
            padding: '10px 24px',
            backgroundColor: '#e53e3e',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '15px',
            cursor: 'pointer',
          }}
        >
          {loading ? 'Cancelling…' : 'Confirm Cancellation'}
        </button>
        <button
          onClick={() => router.back()}
          disabled={loading}
          style={{
            padding: '10px 24px',
            backgroundColor: '#fff',
            color: '#333',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '15px',
            cursor: 'pointer',
          }}
        >
          Go Back
        </button>
      </div>
    </div>
  );
}
