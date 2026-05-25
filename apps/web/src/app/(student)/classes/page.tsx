import Link from 'next/link';
import { DateTime } from 'luxon';

interface SessionDto {
  id: string;
  title: string;
  categoryId: string;
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

interface SessionListResponse {
  items: SessionDto[];
  total: number;
  page: number;
}

async function getSessions(searchParams: Record<string, string>): Promise<SessionListResponse> {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  const params = new URLSearchParams(searchParams);

  const res = await fetch(`${apiUrl}/classes/sessions?${params.toString()}`, {
    cache: 'no-store',
  });

  if (!res.ok) return { items: [], total: 0, page: 1 };
  return res.json() as Promise<SessionListResponse>;
}

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(cents / 100);
}

function formatPerthTime(iso: string | undefined | null): string {
  if (!iso) return '';
  return DateTime.fromISO(iso, { zone: 'Australia/Perth' }).toFormat('EEE d MMM yyyy, h:mm a');
}

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const { items, total } = await getSessions(params);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Browse Classes</h1>
      <p style={{ color: '#666', marginBottom: '24px' }}>
        {total} session{total !== 1 ? 's' : ''} available
      </p>

      {/* Filters */}
      <form method="GET" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <input
          name="dateFrom"
          type="date"
          defaultValue={params['dateFrom'] ?? ''}
          style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          placeholder="From date"
        />
        <input
          name="dateTo"
          type="date"
          defaultValue={params['dateTo'] ?? ''}
          style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          placeholder="To date"
        />
        <button
          type="submit"
          style={{
            padding: '8px 16px',
            backgroundColor: '#1a1a2e',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Filter
        </button>
      </form>

      {items.length === 0 ? (
        <p style={{ color: '#888' }}>No sessions found. Try adjusting your filters.</p>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {items.map((session) => (
            <div
              key={session.id}
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
                  <h2 style={{ fontSize: '20px', margin: '0 0 4px' }}>{session.title}</h2>
                  <p style={{ color: '#555', margin: '0 0 8px', fontSize: '14px' }}>
                    {formatPerthTime(session.startsAtPerth)} (Perth)
                  </p>
                  <p style={{ color: '#666', margin: '0 0 4px', fontSize: '14px' }}>
                    Instructor: {session.instructorName}
                  </p>
                  <p style={{ color: '#666', margin: '0', fontSize: '14px' }}>
                    {session.locationName} — {session.locationAddress}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px' }}>
                    {formatPrice(session.priceCents, session.currency)}
                  </p>
                  <p
                    style={{
                      fontSize: '13px',
                      color: session.seatsAvailable === 0 ? '#e53e3e' : '#38a169',
                      margin: '0 0 12px',
                    }}
                  >
                    {session.seatsAvailable === 0
                      ? 'Full — join waitlist'
                      : `${session.seatsAvailable} seat${session.seatsAvailable !== 1 ? 's' : ''} left`}
                  </p>
                  {session.seatsAvailable > 0 ? (
                    <Link
                      href={`/bookings/checkout?sessionId=${session.id}`}
                      style={{
                        display: 'inline-block',
                        padding: '8px 20px',
                        backgroundColor: '#1a1a2e',
                        color: '#fff',
                        borderRadius: '4px',
                        textDecoration: 'none',
                        fontSize: '14px',
                      }}
                    >
                      Book Now
                    </Link>
                  ) : (
                    <Link
                      href={`/waitlist?sessionId=${session.id}`}
                      style={{
                        display: 'inline-block',
                        padding: '8px 20px',
                        backgroundColor: '#718096',
                        color: '#fff',
                        borderRadius: '4px',
                        textDecoration: 'none',
                        fontSize: '14px',
                      }}
                    >
                      Join Waitlist
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
