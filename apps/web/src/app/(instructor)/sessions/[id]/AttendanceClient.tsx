'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Attendee {
  id: string;
  status: string;
  amountCents: number;
  checkedInAt: string | null;
  user: { id: string; name: string; email: string };
}

const STATUS_COLOR: Record<string, string> = {
  CONFIRMED: '#38a169',
  ATTENDED: '#3182ce',
  NO_SHOW: '#e53e3e',
  CANCELLED: '#718096',
  HELD: '#d69e2e',
  EXPIRED: '#718096',
};

export default function AttendanceClient({
  sessionId,
  initialAttendees,
}: {
  sessionId: string;
  initialAttendees: Attendee[];
}) {
  const router = useRouter();
  const [attendees, setAttendees] = useState(initialAttendees);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function markAttendance(bookingId: string, status: 'ATTENDED' | 'NO_SHOW') {
    setLoading(bookingId);
    setError(null);
    try {
      const res = await fetch(`/api/v1/instructor/sessions/${sessionId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bookingId, status }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? 'Failed to record attendance');
      }
      const updated = await res.json() as Attendee;
      setAttendees((prev) => prev.map((a) => (a.id === bookingId ? { ...a, ...updated } : a)));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(null);
    }
  }

  if (attendees.length === 0) {
    return <p style={{ color: '#888' }}>No bookings for this session.</p>;
  }

  return (
    <div>
      {error && <p style={{ color: '#e53e3e', fontSize: '14px', marginBottom: '12px' }}>{error}</p>}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '14px',
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <thead>
          <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
            <th style={{ padding: '12px 16px', textAlign: 'left', color: '#555' }}>Student</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', color: '#555' }}>Email</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', color: '#555' }}>Status</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', color: '#555' }}>Check-in</th>
            <th style={{ padding: '12px 16px' }} />
          </tr>
        </thead>
        <tbody>
          {attendees.map((a) => (
            <tr key={a.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '12px 16px', fontWeight: 500 }}>{a.user.name}</td>
              <td style={{ padding: '12px 16px', color: '#666' }}>{a.user.email}</td>
              <td style={{ padding: '12px 16px' }}>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    backgroundColor: (STATUS_COLOR[a.status] ?? '#718096') + '22',
                    color: STATUS_COLOR[a.status] ?? '#718096',
                    fontWeight: 600,
                  }}
                >
                  {a.status}
                </span>
              </td>
              <td style={{ padding: '12px 16px', color: '#666', fontSize: '13px' }}>
                {a.checkedInAt ? new Date(a.checkedInAt).toLocaleTimeString('en-AU') : '—'}
              </td>
              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                {a.status === 'CONFIRMED' && (
                  <span style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => void markAttendance(a.id, 'ATTENDED')}
                      disabled={loading === a.id}
                      style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                        backgroundColor: '#38a169',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      {loading === a.id ? '…' : 'Attended'}
                    </button>
                    <button
                      onClick={() => void markAttendance(a.id, 'NO_SHOW')}
                      disabled={loading === a.id}
                      style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                        backgroundColor: '#e53e3e',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      No Show
                    </button>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
