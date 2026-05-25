'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  sessionId: string;
  currentStatus: string;
}

export default function SessionActions({ sessionId, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancelSession() {
    if (!confirm('Cancel this session? All confirmed students will be notified.')) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/sessions/${sessionId}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Cancel failed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  if (currentStatus !== 'SCHEDULED') return null;

  return (
    <span>
      {error && <span style={{ color: '#e53e3e', fontSize: '12px', marginRight: '8px' }}>{error}</span>}
      <button
        onClick={() => void cancelSession()}
        disabled={loading}
        style={{ padding: '3px 10px', fontSize: '12px', backgroundColor: '#e53e3e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
      >
        {loading ? '…' : 'Cancel'}
      </button>
    </span>
  );
}
