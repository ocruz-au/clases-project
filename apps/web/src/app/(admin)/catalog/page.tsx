import { cookies } from 'next/headers';
import CatalogClient from './CatalogClient';

async function fetchAll(token: string) {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  const headers = { Authorization: `Bearer ${token}` };

  const [catRes, locRes] = await Promise.all([
    fetch(`${apiUrl}/admin/categories`, { headers, cache: 'no-store' }),
    fetch(`${apiUrl}/admin/locations`, { headers, cache: 'no-store' }),
  ]);

  const categories = catRes.ok ? (await catRes.json()) as unknown[] : [];
  const locations = locRes.ok ? (await locRes.json()) as unknown[] : [];

  return { categories, locations };
}

export default async function AdminCatalogPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value ?? '';
  const { categories, locations } = await fetchAll(token);

  return (
    <div style={{ padding: '32px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '24px' }}>Catalog Management</h1>
      <CatalogClient initialCategories={categories} initialLocations={locations} />
    </div>
  );
}
