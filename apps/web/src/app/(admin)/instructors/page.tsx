import { cookies } from 'next/headers';
import InstructorManager from './InstructorManager';

interface InstructorDto {
  id: string;
  bio: string;
  deletedAt: string | null;
  user: { id: string; name: string; email: string };
}

async function getInstructors(token: string): Promise<InstructorDto[]> {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  const res = await fetch(`${apiUrl}/admin/instructors`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return res.json() as Promise<InstructorDto[]>;
}

export default async function AdminInstructorsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value ?? '';
  const instructors = await getInstructors(token);

  return (
    <div style={{ padding: '32px', maxWidth: '800px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '24px' }}>Instructors</h1>
      <InstructorManager initialInstructors={instructors} />
    </div>
  );
}
