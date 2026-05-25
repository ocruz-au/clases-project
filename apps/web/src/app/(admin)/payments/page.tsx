import { cookies } from 'next/headers';
import PaymentsClient from './PaymentsClient';

interface RefundDto { id: string; amountCents: number; status: string }

interface PaymentDto {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
  stripePaymentIntentId: string | null;
  user: { id: string; name: string; email: string };
  refunds: RefundDto[];
  bookings: { session: { class: { title: string } } }[];
}

async function getPayments(token: string, status?: string): Promise<{ payments: PaymentDto[]; total: number }> {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  const params = status ? `?status=${status}` : '';
  const res = await fetch(`${apiUrl}/admin/payments${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return { payments: [], total: 0 };
  return res.json() as Promise<{ payments: PaymentDto[]; total: number }>;
}

const STATUS_OPTIONS = ['', 'PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'];

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value ?? '';
  const { payments, total } = await getPayments(token, status);

  return (
    <div style={{ padding: '32px', maxWidth: '1200px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Payments</h1>
      <p style={{ color: '#666', marginBottom: '16px', fontSize: '14px' }}>{total} total</p>

      {/* Status filter */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {STATUS_OPTIONS.map((s) => (
          <a
            key={s || 'all'}
            href={s ? `?status=${s}` : '?'}
            style={{
              padding: '4px 14px',
              borderRadius: '20px',
              fontSize: '13px',
              textDecoration: 'none',
              backgroundColor: (status ?? '') === s ? '#1a1a2e' : '#f0f0f0',
              color: (status ?? '') === s ? '#fff' : '#555',
            }}
          >
            {s || 'All'}
          </a>
        ))}
      </div>

      <PaymentsClient initialPayments={payments} />
    </div>
  );
}
