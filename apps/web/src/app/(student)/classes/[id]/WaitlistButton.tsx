'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  sessionId: string;
}

export default function WaitlistButton({ sessionId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);
  const [position, setPosition] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ classSessionId: sessionId }),
      });

      if (res.status === 401) {
        router.push('/auth/signin?callbackUrl=/classes/' + sessionId);
        return;
      }

      if (res.status === 409) {
        setError("You're already on the waitlist for this session.");
        return;
      }

      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        setError(body.message ?? 'Failed to join waitlist.');
        return;
      }

      const data = (await res.json()) as { position: number };
      setPosition(data.position);
      setJoined(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (joined) {
    return (
      <div
        style={{
          padding: '16px',
          backgroundColor: '#f0fff4',
          border: '1px solid #9ae6b4',
          borderRadius: '6px',
        }}
      >
        <p style={{ color: '#276749', fontWeight: 'bold', margin: '0 0 4px' }}>
          You're on the waitlist!
        </p>
        {position && (
          <p style={{ color: '#276749', margin: 0, fontSize: '14px' }}>
            Your position: #{position}
          </p>
        )}
        <p style={{ color: '#555', margin: '8px 0 0', fontSize: '13px' }}>
          We'll email you if a seat becomes available.
        </p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <p
          style={{
            color: '#e53e3e',
            fontSize: '14px',
            marginBottom: '12px',
            padding: '10px',
            background: '#fff5f5',
            borderRadius: '4px',
          }}
        >
          {error}
        </p>
      )}
      <button
        onClick={() => void handleJoin()}
        disabled={loading}
        style={{
          padding: '12px 28px',
          backgroundColor: loading ? '#718096' : '#718096',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          fontSize: '15px',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Joining waitlist…' : 'Join Waitlist'}
      </button>
    </div>
  );
}
