import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import CancelBookingClient from './CancelBookingClient';

interface PolicyRule { hoursBefore: number; refundPercent: number }

interface BookingDto {
  id: string;
  status: string;
  amountCents: number;
  session: {
    startsAt: string;
    class: {
      title: string;
      currency: string;
      cancellationPolicy?: { rules: PolicyRule[] } | null;
    };
    room: { name: string; location: { name: string } };
    cancellationPolicy?: { rules: PolicyRule[] } | null;
  };
}

async function getBooking(id: string, token: string): Promise<BookingDto | null> {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  const res = await fetch(`${apiUrl}/bookings/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json() as Promise<BookingDto>;
}

export default async function CancelBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) redirect('/auth/login');

  const booking = await getBooking(id, token);
  if (!booking) notFound();
  if (booking.status !== 'CONFIRMED') redirect('/bookings');

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Cancel Booking</h1>
      <p style={{ color: '#666', marginBottom: '24px', fontSize: '14px' }}>
        Please review the details below before confirming your cancellation.
      </p>
      <CancelBookingClient booking={booking} />
    </div>
  );
}
