'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function CheckoutForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId') ?? '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBookNow() {
    if (!sessionId) {
      setError('No session selected.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/bookings/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ classSessionId: sessionId }),
      });

      if (res.status === 401) {
        router.push('/auth/signin?callbackUrl=/bookings/checkout?sessionId=' + sessionId);
        return;
      }

      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        setError(body.message ?? 'Checkout failed. Please try again.');
        return;
      }

      const data = (await res.json()) as { stripeCheckoutUrl: string };
      window.location.href = data.stripeCheckoutUrl;
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: '480px', margin: '80px auto', padding: '32px', border: '1px solid #e0e0e0', borderRadius: '8px', backgroundColor: '#fff' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Confirm Booking</h1>
      <p style={{ color: '#555', marginBottom: '24px', fontSize: '14px' }}>
        You will be redirected to Stripe to complete your payment securely.
      </p>

      {error && (
        <p style={{ color: '#e53e3e', marginBottom: '16px', fontSize: '14px', padding: '10px', background: '#fff5f5', borderRadius: '4px' }}>
          {error}
        </p>
      )}

      <button
        onClick={() => void handleBookNow()}
        disabled={loading || !sessionId}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: loading ? '#718096' : '#1a1a2e',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          fontSize: '16px',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Redirecting to payment…' : 'Proceed to Payment'}
      </button>

      <button
        onClick={() => router.back()}
        style={{
          width: '100%',
          marginTop: '12px',
          padding: '10px',
          backgroundColor: 'transparent',
          color: '#555',
          border: '1px solid #ddd',
          borderRadius: '4px',
          fontSize: '14px',
          cursor: 'pointer',
        }}
      >
        Cancel
      </button>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '80px' }}>Loading…</div>}>
      <CheckoutForm />
    </Suspense>
  );
}
