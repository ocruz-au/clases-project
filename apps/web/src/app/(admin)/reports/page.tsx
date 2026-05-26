import { cookies } from 'next/headers';
import ReportsClient from './ReportsClient';

const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';

async function fetchReport<T>(endpoint: string, token: string, from: string, to: string): Promise<T | null> {
  const res = await fetch(`${apiUrl}/admin/reports/${endpoint}?from=${from}&to=${to}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

function defaultDateRange() {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  return { from, to };
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from: qFrom, to: qTo } = await searchParams;
  const { from, to } = qFrom && qTo ? { from: qFrom, to: qTo } : defaultDateRange();

  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value ?? '';

  const [bookings, revenue, attendance, cancellations, waitlist] = await Promise.all([
    fetchReport<{ total: number }>(
      'bookings', token, from, to),
    fetchReport<{ totalCents: number; count: number }>(
      'revenue', token, from, to),
    fetchReport<{ CONFIRMED: number; ATTENDED: number; NO_SHOW: number }>(
      'attendance', token, from, to),
    fetchReport<{ total: number }>(
      'cancellations', token, from, to),
    fetchReport<{ total: number; converted: number; rate: number }>(
      'waitlist-conversion', token, from, to),
  ]);

  return (
    <div style={{ padding: '32px', maxWidth: '1100px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Reports</h1>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>
        Date range shown in Perth local time (AWST, UTC+8).
      </p>
      <ReportsClient
        from={from}
        to={to}
        bookings={bookings}
        revenue={revenue}
        attendance={attendance}
        cancellations={cancellations}
        waitlist={waitlist}
      />
    </div>
  );
}
