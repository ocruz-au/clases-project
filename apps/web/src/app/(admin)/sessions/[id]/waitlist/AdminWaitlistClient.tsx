'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  entryId: string;
  sessionId: string;
}

type Action = 'REMOVE' | 'SKIP' | 'PROMOTE';

export default function AdminWaitlistClient({ entryId, sessionId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function takeAction(action: Action) {
    setLoading(action);
    setError(null);

    try {
      const res = await fetch(`/api/v1/admin/waitlist/entries/${entryId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        setError(body.message ?? 'Action failed.');
        return;
      }

      router.refresh();
    } catch {
      setError('Network error.');
    } finally {
      setLoading(null);
    }
  }

  const btnStyle = (color: string, disabled: boolean) => ({
    padding: '4px 12px',
    fontSize: '12px',
    backgroundColor: disabled ? '#ccc' : color,
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    marginRight: '6px',
  });

  return (
    <div>
      {error && (
        <p style={{ color: '#e53e3e', fontSize: '12px', marginBottom: '6px' }}>{error}</p>
      )}
      <button
        onClick={() => void takeAction('REMOVE')}
        disabled={loading !== null}
        style={btnStyle('#e53e3e', loading !== null)}
      >
        {loading === 'REMOVE' ? '…' : 'Remove'}
      </button>
      <button
        onClick={() => void takeAction('SKIP')}
        disabled={loading !== null}
        style={btnStyle('#718096', loading !== null)}
      >
        {loading === 'SKIP' ? '…' : 'Skip'}
      </button>
      <button
        onClick={() => void takeAction('PROMOTE')}
        disabled={loading !== null}
        style={btnStyle('#38a169', loading !== null)}
      >
        {loading === 'PROMOTE' ? '…' : 'Promote'}
      </button>
    </div>
  );
}
