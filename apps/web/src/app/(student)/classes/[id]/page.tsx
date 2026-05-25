import Link from 'next/link';
import { DateTime } from 'luxon';
import WaitlistButton from './WaitlistButton';

interface SessionDetailDto {
  id: string;
  title: string;
  instructorName: string;
  locationName: string;
  locationAddress: string;
  startsAt: string;
  endsAt: string;
  startsAtPerth: string;
  capacity: number;
  seatsAvailable: number;
  priceCents: number;
  currency: string;
  status: string;
}

async function getSession(id: string): Promise<SessionDetailDto | null> {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  const res = await fetch(`${apiUrl}/classes/sessions/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json() as Promise<SessionDetailDto>;
}

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(cents / 100);
}

function formatPerthTime(iso: string | undefined | null): string {
  if (!iso) return '';
  return DateTime.fromISO(iso, { zone: 'Australia/Perth' }).toFormat('EEE d MMM yyyy, h:mm a');
}

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession(id);

  if (!session) {
    return (
      <div style={{ maxWidth: '600px', margin: '80px auto', padding: '16px', textAlign: 'center' }}>
        <p style={{ color: '#888' }}>Session not found.</p>
        <Link href="/classes" style={{ color: '#1a1a2e' }}>← Back to Classes</Link>
      </div>
    );
  }

  const isFull = session.seatsAvailable === 0;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 16px' }}>
      <Link href="/classes" style={{ color: '#555', fontSize: '14px', textDecoration: 'none' }}>
        ← Back to Classes
      </Link>

      <div
        style={{
          marginTop: '20px',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: '24px',
          backgroundColor: '#fff',
        }}
      >
        <h1 style={{ fontSize: '26px', margin: '0 0 8px' }}>{session.title}</h1>
        <p style={{ color: '#555', fontSize: '15px', margin: '0 0 16px' }}>
          {formatPerthTime(session.startsAtPerth)} (Perth)
        </p>

        <div style={{ display: 'grid', gap: '8px', marginBottom: '20px' }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
            <strong>Instructor:</strong> {session.instructorName}
          </p>
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
            <strong>Location:</strong> {session.locationName} — {session.locationAddress}
          </p>
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
            <strong>Capacity:</strong> {session.capacity} seats
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: isFull ? '#e53e3e' : '#38a169',
              fontWeight: 600,
            }}
          >
            {isFull
              ? 'Full — join the waitlist below'
              : `${session.seatsAvailable} seat${session.seatsAvailable !== 1 ? 's' : ''} available`}
          </p>
        </div>

        <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 20px' }}>
          {formatPrice(session.priceCents, session.currency)}
        </p>

        {!isFull ? (
          <Link
            href={`/bookings/checkout?sessionId=${session.id}`}
            style={{
              display: 'inline-block',
              padding: '12px 28px',
              backgroundColor: '#1a1a2e',
              color: '#fff',
              borderRadius: '4px',
              textDecoration: 'none',
              fontSize: '15px',
            }}
          >
            Book Now
          </Link>
        ) : (
          <WaitlistButton sessionId={session.id} />
        )}
      </div>
    </div>
  );
}
