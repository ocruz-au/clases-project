import Link from 'next/link';
import { cookies } from 'next/headers';

interface ClassDto { id: string; title: string; priceCents: number; defaultCapacity: number; category: { name: string } }

async function getClasses(token: string): Promise<ClassDto[]> {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  const res = await fetch(`${apiUrl}/classes`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!res.ok) return [];
  const data = await res.json() as { items: ClassDto[] };
  return data.items ?? [];
}

export default async function AdminClassesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value ?? '';
  const classes = await getClasses(token);

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>Classes & Sessions</h1>
        <Link href="/admin/classes/new"
          style={{ padding: '8px 16px', backgroundColor: '#1a1a2e', color: '#fff', borderRadius: '4px', textDecoration: 'none', fontSize: '14px' }}>
          + New Class
        </Link>
      </div>

      {classes.length === 0 ? (
        <p style={{ color: '#888' }}>No classes yet. Create one to get started.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#555' }}>Title</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#555' }}>Category</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', color: '#555' }}>Price</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', color: '#555' }}>Capacity</th>
              <th style={{ padding: '12px 16px' }} />
            </tr>
          </thead>
          <tbody>
            {classes.map((cls) => (
              <tr key={cls.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{cls.title}</td>
                <td style={{ padding: '12px 16px', color: '#666' }}>{cls.category.name}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  ${(cls.priceCents / 100).toFixed(2)}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>{cls.defaultCapacity}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <Link href={`/admin/classes/${cls.id}/sessions`}
                    style={{ color: '#1a1a2e', fontSize: '13px', marginRight: '12px' }}>Sessions</Link>
                  <Link href={`/admin/classes/${cls.id}/schedule`}
                    style={{ color: '#38a169', fontSize: '13px' }}>+ Schedule</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
