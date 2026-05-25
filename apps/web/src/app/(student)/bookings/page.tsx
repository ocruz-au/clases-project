import Link from 'next/link';
import { DateTime } from 'luxon';
import { cookies } from 'next/headers';

interface BookingDto {
  id: string;
  status: string;
  amountCents: number;
  createdAt: string;
  session: {
    id: string;
    title: string;
    startsAt: string;
    locationName: string;
  };
  payment?: {
    status: string;
  };
}

const STATUS_LABEL: Record<string, string> = {
  HELD: 'Awaiting Payment',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
  ATTENDED: 'Attended',
  NO_SHOW: 'No Show',
};

const STATUS_COLOR: Record<string, string> = {
  HELD: '#d69e2e',
  CONFIRMED: '#38a169',
  CANCELLED: '#718096',
  EXPIRED: '#718096',
  ATTENDED: '#3182ce',
  NO_SHOW: '#e53e3e',
};

async function getBookings(): Promise<BookingDto[]> {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) return [];

  const res = await fetch(`${apiUrl}/bookings`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!res.ok) return [];
  return res.json() as Promise<BookingDto[]>;
}

function formatPerthTime(iso: string): string {
  return DateTime.fromISO(iso, { zone: 'Australia/Perth' }).toFormat('EEE d MMM yyyy, h:mm a');
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
}

export default async function BookingsPage() {
  const bookings = await getBookings();

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>My Bookings</h1>
      <p style={{ color: '#666', marginBottom: '24px' }}>
        {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
      </p>

      {bookings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ color: '#888', marginBottom: '16px' }}>You have no bookings yet.</p>
          <Link
            href="/classes"
            style={{
              display: 'inline-block',
              padding: '10px 24px',
              backgroundColor: '#1a1a2e',
              color: '#fff',
              borderRadius: '4px',
              textDecoration: 'none',
              fontSize: '14px',
            }}
          >
            Browse Classes
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {bookings.map((booking) => (
            <div
              key={booking.id}
              style={{
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                padding: '20px',
                backgroundColor: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: '18px', margin: '0 0 4px' }}>{booking.session.title}</h2>
                  <p style={{ color: '#555', margin: '0 0 4px', fontSize: '14px' }}>
                    {formatPerthTime(booking.session.startsAt)} (Perth)
                  </p>
                  <p style={{ color: '#666', margin: '0', fontSize: '14px' }}>
                    {booking.session.locationName}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor: STATUS_COLOR[booking.status] + '22',
                      color: STATUS_COLOR[booking.status] ?? '#718096',
                      marginBottom: '8px',
                    }}
                  >
                    {STATUS_LABEL[booking.status] ?? booking.status}
                  </span>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', margin: '0' }}>
                    {formatPrice(booking.amountCents)}
                  </p>
                </div>
              </div>

              {booking.status === 'CONFIRMED' && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f0f0f0' }}>
                  <Link
                    href={`/bookings/${booking.id}/cancel`}
                    style={{ color: '#e53e3e', fontSize: '13px', textDecoration: 'none' }}
                  >
                    Cancel booking
                  </Link>
                </div>
              )}

              {booking.status === 'HELD' && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f0f0f0' }}>
                  <Link
                    href={`/bookings/checkout?sessionId=${booking.session.id}`}
                    style={{ color: '#d69e2e', fontSize: '13px', textDecoration: 'none' }}
                  >
                    Complete payment →
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
