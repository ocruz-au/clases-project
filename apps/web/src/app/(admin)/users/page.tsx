import { cookies } from 'next/headers';
import UserManager from './UserManager';

interface UserDto {
  id: string;
  email: string;
  name: string;
  status: string;
  deletedAt: string | null;
  userRoles: { role: { key: string } }[];
}

async function getUsers(token: string): Promise<UserDto[]> {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  const res = await fetch(`${apiUrl}/admin/users?page=1`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const body = await res.json() as { users: UserDto[] };
  return body.users;
}

export default async function AdminUsersPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value ?? '';
  const users = await getUsers(token);

  return (
    <div style={{ padding: '32px', maxWidth: '1000px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '24px' }}>Users</h1>
      <UserManager initialUsers={users} />
    </div>
  );
}
