import { cookies } from 'next/headers';
import SettingsClient from './SettingsClient';

interface SettingRow {
  key: string;
  value: unknown;
  scope: string;
  updatedAt: string;
}

async function getSettings(token: string): Promise<SettingRow[]> {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  const res = await fetch(`${apiUrl}/settings`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return res.json() as Promise<SettingRow[]>;
}

export default async function SuperAdminSettingsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value ?? '';
  const settings = await getSettings(token);

  return (
    <div style={{ padding: '32px', maxWidth: '800px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Global Settings</h1>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '32px' }}>
        Changes take effect within 60 seconds (cached). Super admin only.
      </p>
      <SettingsClient initialSettings={settings} />
    </div>
  );
}
