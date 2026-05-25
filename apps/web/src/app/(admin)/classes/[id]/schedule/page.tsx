import { cookies } from 'next/headers';
import ScheduleGeneratorClient from './ScheduleGeneratorClient';

async function getSetupData(token: string) {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  const headers = { Authorization: `Bearer ${token}` };

  const [roomsRes, instructorsRes] = await Promise.all([
    fetch(`${apiUrl}/admin/rooms`, { headers, cache: 'no-store' }),
    fetch(`${apiUrl}/admin/instructors`, { headers, cache: 'no-store' }),
  ]);

  const rooms = roomsRes.ok ? (await roomsRes.json()) as unknown[] : [];
  const instructors = instructorsRes.ok ? (await instructorsRes.json()) as unknown[] : [];

  return { rooms, instructors };
}

export default async function ScheduleGeneratorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: classId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value ?? '';
  const { rooms, instructors } = await getSetupData(token);

  return (
    <div style={{ padding: '32px', maxWidth: '600px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '24px' }}>Generate Schedule</h1>
      <ScheduleGeneratorClient classId={classId} rooms={rooms} instructors={instructors} />
    </div>
  );
}
