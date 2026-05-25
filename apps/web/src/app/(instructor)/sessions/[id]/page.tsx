import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { DateTime } from 'luxon';
import AttendanceClient from './AttendanceClient';

interface Attendee {
  id: string;
  status: string;
  amountCents: number;
  checkedInAt: string | null;
  user: { id: string; name: string; email: string };
}

interface SessionDto {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  capacity: number;
  class: { title: string; currency: string };
  room: { name: string; location: { name: string } };
}

async function getSession(id: string, token: string): Promise<SessionDto | null> {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  const res = await fetch(`${apiUrl}/instructor/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const sessions = await res.json() as SessionDto[];
  return sessions.find((s) => s.id === id) ?? null;
}

async function getAttendees(sessionId: string, token: string): Promise<Attendee[]> {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  const res = await fetch(`${apiUrl}/instructor/sessions/${sessionId}/attendees`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return res.json() as Promise<Attendee[]>;
}

export default async function InstructorSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value ?? '';

  const [session, attendees] = await Promise.all([
    getSession(id, token),
    getAttendees(id, token),
  ]);

  if (!session) notFound();

  const perthStart = DateTime.fromISO(session.startsAt, { zone: 'Australia/Perth' });
  const perthEnd = DateTime.fromISO(session.endsAt, { zone: 'Australia/Perth' });

  const confirmed = attendees.filter((a) => a.status === 'CONFIRMED').length;
  const attended = attendees.filter((a) => a.status === 'ATTENDED').length;
  const noShow = attendees.filter((a) => a.status === 'NO_SHOW').length;

  return (
    <div style={{ padding: '32px', maxWidth: '900px' }}>
      <Link href="/instructor" style={{ color: '#3182ce', fontSize: '13px', textDecoration: 'none' }}>
        ← Back to sessions
      </Link>

      <h1 style={{ fontSize: '24px', margin: '16px 0 4px' }}>{session.class.title}</h1>
      <p style={{ color: '#555', margin: '0 0 4px', fontSize: '14px' }}>
        {perthStart.toFormat('EEEE, d MMMM yyyy')} · {perthStart.toFormat('h:mm a')}–{perthEnd.toFormat('h:mm a')} (Perth)
      </p>
      <p style={{ color: '#888', margin: '0 0 24px', fontSize: '14px' }}>
        {session.room.location.name} — {session.room.name} · Capacity {session.capacity}
      </p>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { label: 'Confirmed', value: confirmed, color: '#38a169' },
          { label: 'Attended', value: attended, color: '#3182ce' },
          { label: 'No Show', value: noShow, color: '#e53e3e' },
          { label: 'Total bookings', value: attendees.length, color: '#555' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              flex: '1 1 120px',
              padding: '16px',
              backgroundColor: '#fff',
              borderRadius: '8px',
              border: '1px solid #e0e0e0',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: 'bold', color }}>{value}</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>{label}</p>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: '16px', marginBottom: '12px' }}>Attendees</h2>
      <AttendanceClient sessionId={id} initialAttendees={attendees} />
    </div>
  );
}
