import { cookies } from 'next/headers';
import AdminWaitlistClient from './AdminWaitlistClient';

interface WaitlistEntry {
  id: string;
  position: number;
  status: string;
  user: { id: string; name: string; email: string };
  offeredSeatHoldId: string | null;
}

async function getWaitlist(sessionId: string): Promise<WaitlistEntry[]> {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return [];

  const res = await fetch(`${apiUrl}/admin/waitlist/session/${sessionId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return res.json() as Promise<WaitlistEntry[]>;
}

const STATUS_COLOR: Record<string, string> = {
  WAITING: '#2b6cb0',
  OFFERED: '#d69e2e',
  CONVERTED: '#38a169',
  REMOVED: '#718096',
  SKIPPED: '#718096',
  EXPIRED: '#e53e3e',
};

export default async function AdminWaitlistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = await params;
  const entries = await getWaitlist(sessionId);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '4px' }}>Waitlist Management</h1>
      <p style={{ color: '#666', marginBottom: '24px', fontSize: '14px' }}>
        Session ID: {sessionId} — {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}
      </p>

      {entries.length === 0 ? (
        <p style={{ color: '#888' }}>No waitlist entries for this session.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px', fontSize: '13px', color: '#666' }}>#</th>
              <th style={{ padding: '8px 12px', fontSize: '13px', color: '#666' }}>Student</th>
              <th style={{ padding: '8px 12px', fontSize: '13px', color: '#666' }}>Status</th>
              <th style={{ padding: '8px 12px', fontSize: '13px', color: '#666' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px', fontSize: '14px', fontWeight: 600 }}>
                  {entry.position}
                </td>
                <td style={{ padding: '12px' }}>
                  <p style={{ margin: 0, fontSize: '14px' }}>{entry.user.name}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>{entry.user.email}</p>
                </td>
                <td style={{ padding: '12px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor: (STATUS_COLOR[entry.status] ?? '#718096') + '22',
                      color: STATUS_COLOR[entry.status] ?? '#718096',
                    }}
                  >
                    {entry.status}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>
                  {entry.status === 'WAITING' && (
                    <AdminWaitlistClient entryId={entry.id} sessionId={sessionId} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
