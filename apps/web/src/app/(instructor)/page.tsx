import { cookies } from 'next/headers';
import Link from 'next/link';
import { DateTime } from 'luxon';

interface SessionDto {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  class: { title: string };
  room: { name: string; location: { name: string } };
  _count: { bookings: number };
}

async function getSessions(token: string): Promise<SessionDto[]> {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  const res = await fetch(`${apiUrl}/instructor/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return res.json() as Promise<SessionDto[]>;
}

function formatPerth(iso: string) {
  return DateTime.fromISO(iso, { zone: 'Australia/Perth' }).toFormat('EEE d MMM, h:mm a');
}

export default async function InstructorDashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value ?? '';
  const sessions = await getSessions(token);

  const now = new Date();
  const upcoming = sessions.filter((s) => new Date(s.startsAt) > now);
  const past = sessions.filter((s) => new Date(s.startsAt) <= now);

  function SessionCard({ session }: { session: SessionDto }) {
    return (
      <Link
        href={`/instructor/sessions/${session.id}`}
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        <div
          style={{
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            padding: '16px 20px',
            backgroundColor: '#fff',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '15px' }}>
              {session.class.title}
            </p>
            <p style={{ margin: '0 0 2px', color: '#555', fontSize: '13px' }}>
              {formatPerth(session.startsAt)} (Perth)
            </p>
            <p style={{ margin: 0, color: '#888', fontSize: '13px' }}>
              {session.room.location.name} — {session.room.name}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#555' }}>
              {session._count.bookings} booking{session._count.bookings !== 1 ? 's' : ''}
            </p>
            <span
              style={{
                display: 'inline-block',
                marginTop: '4px',
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '11px',
                backgroundColor: session.status === 'SCHEDULED' ? '#ebf8ff' : '#f0f0f0',
                color: session.status === 'SCHEDULED' ? '#2b6cb0' : '#718096',
              }}
            >
              {session.status}
            </span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div style={{ padding: '32px', maxWidth: '760px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '24px' }}>My Sessions</h1>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', color: '#555', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Upcoming ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <p style={{ color: '#888' }}>No upcoming sessions.</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {upcoming.map((s) => <SessionCard key={s.id} session={s} />)}
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: '16px', color: '#555', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Past ({past.length})
        </h2>
        {past.length === 0 ? (
          <p style={{ color: '#888' }}>No past sessions.</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {past.map((s) => <SessionCard key={s.id} session={s} />)}
          </div>
        )}
      </section>
    </div>
  );
}
