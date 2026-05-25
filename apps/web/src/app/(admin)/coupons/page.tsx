import { cookies } from 'next/headers';
import CouponManager from './CouponManager';

interface CouponDto {
  id: string;
  code: string;
  type: string;
  value: number;
  validFrom: string;
  validUntil: string;
  maxRedemptions: number | null;
  redeemedCount: number;
  deletedAt: string | null;
}

async function getCoupons(token: string): Promise<CouponDto[]> {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  const res = await fetch(`${apiUrl}/admin/coupons`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return res.json() as Promise<CouponDto[]>;
}

export default async function AdminCouponsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value ?? '';
  const coupons = await getCoupons(token);

  return (
    <div style={{ padding: '32px', maxWidth: '1000px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '24px' }}>Coupons</h1>
      <CouponManager initialCoupons={coupons} />
    </div>
  );
}
