import Link from 'next/link';
import { cookies } from 'next/headers';
import { DateTime } from 'luxon';
import SessionActions from './SessionActions';

interface SessionDto {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  startsAtPerth: string;
  capacity: number;
  seatsAvailable: number;
  status: string;
}

async function getSessions(classId: string, token: string) {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  const res = await fetch(`${apiUrl}/classes/sessions?classId=${classId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const data = await res.json() as { items: SessionDto[] };
  return data.items ?? [];
}

function formatPerth(iso: string | null | undefined) {
  if (!iso) return '';
  return DateTime.fromISO(iso, { zone: 'Australia/Perth' }).toFormat('EEE d MMM yyyy, h:mm a');
}

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: '#38a169',
  CANCELLED: '#718096',
  COMPLETED: '#3182ce',
};

export default async function AdminSessionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: classId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value ?? '';
  const sessions = await getSessions(classId, token);

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>Sessions</h1>
        <Link href={`/admin/classes/${classId}/schedule`}
          style={{ padding: '8px 16px', backgroundColor: '#38a169', color: '#fff', borderRadius: '4px', textDecoration: 'none', fontSize: '14px' }}>
          Generate Schedule
        </Link>
      </div>
      <Link href="/admin/classes" style={{ color: '#888', fontSize: '13px', display: 'block', marginBottom: '24px' }}>← Classes</Link>

      {sessions.length === 0 ? (
        <p style={{ color: '#888' }}>No sessions. Use "Generate Schedule" to create them.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#555' }}>Date / Time (Perth)</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', color: '#555' }}>Capacity</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', color: '#555' }}>Available</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#555' }}>Status</th>
              <th style={{ padding: '12px 16px' }} />
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px 16px' }}>{formatPerth(s.startsAtPerth)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>{s.capacity}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>{s.seatsAvailable}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 600,
                    backgroundColor: (STATUS_COLOR[s.status] ?? '#718096') + '22',
                    color: STATUS_COLOR[s.status] ?? '#718096' }}>
                    {s.status}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <Link href={`/admin/sessions/${s.id}/waitlist`}
                    style={{ color: '#555', fontSize: '13px', marginRight: '12px' }}>Waitlist</Link>
                  <SessionActions sessionId={s.id} currentStatus={s.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
