'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SettingRow {
  key: string;
  value: unknown;
  scope: string;
  updatedAt: string;
}

const GLOBAL_SETTINGS = [
  { key: 'seatHoldWindowMinutes', label: 'Seat Hold Window (minutes)', type: 'number', defaultValue: 10, hint: 'How long a seat is held during checkout before release.' },
  { key: 'reminderLeadHours', label: 'Reminder Lead Time (hours)', type: 'number', defaultValue: 24, hint: 'Hours before a session when reminder emails are sent.' },
  { key: 'defaultCancellationPolicyId', label: 'Default Cancellation Policy ID', type: 'text', defaultValue: '', hint: 'UUID of the fallback cancellation policy.' },
];

const SECURITY_SETTINGS = [
  { key: 'sessionExpiryHours', label: 'Session Expiry (hours)', type: 'number', defaultValue: 24, hint: 'JWT/session lifetime in hours.' },
  { key: 'maxLoginAttempts', label: 'Max Login Attempts', type: 'number', defaultValue: 5, hint: 'Lockout after this many failed logins.' },
];

function getValue(settings: SettingRow[], key: string, def: unknown): string {
  const row = settings.find((s) => s.key === key);
  const val = row ? row.value : def;
  return val !== null && val !== undefined ? String(val) : '';
}

export default function SettingsClient({ initialSettings }: { initialSettings: SettingRow[] }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    [...GLOBAL_SETTINGS, ...SECURITY_SETTINGS].forEach(({ key, defaultValue }) => {
      init[key] = getValue(initialSettings, key, defaultValue);
    });
    return init;
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function handleSave(key: string, type: string) {
    setSaving(key);
    setError(null);
    setSaved(null);
    const raw = form[key] ?? '';
    const value = type === 'number' ? Number(raw) : raw;

    try {
      const res = await fetch(`/api/v1/settings/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ value }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? 'Save failed');
      }
      const updated = await res.json() as SettingRow;
      setSettings((prev) => {
        const existing = prev.find((s) => s.key === key);
        return existing
          ? prev.map((s) => (s.key === key ? updated : s))
          : [...prev, updated];
      });
      setSaved(key);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(null);
    }
  }

  const inputStyle = {
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    width: '260px',
  };

  const renderSection = (title: string, defs: typeof GLOBAL_SETTINGS) => (
    <div
      style={{
        backgroundColor: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '24px',
        marginBottom: '24px',
      }}
    >
      <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 20px', color: '#1a1a2e' }}>{title}</h2>
      {defs.map(({ key, label, type, defaultValue, hint }) => (
        <div key={key} style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#333', marginBottom: '4px' }}>
            {label}
          </label>
          <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#888' }}>{hint}</p>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type={type}
              value={form[key] ?? String(defaultValue)}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              style={inputStyle}
            />
            <button
              onClick={() => void handleSave(key, type)}
              disabled={saving === key}
              style={{
                padding: '8px 16px',
                backgroundColor: '#1a1a2e',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              {saving === key ? 'Saving…' : 'Save'}
            </button>
            {saved === key && (
              <span style={{ fontSize: '12px', color: '#38a169' }}>Saved</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      {error && (
        <p style={{ color: '#e53e3e', fontSize: '14px', marginBottom: '16px' }}>{error}</p>
      )}
      {settings.length > 0 && (
        <p style={{ fontSize: '12px', color: '#888', marginBottom: '20px' }}>
          Last updated: {new Date(settings[0].updatedAt).toLocaleString('en-AU')}
        </p>
      )}
      {renderSection('Global Settings', GLOBAL_SETTINGS)}
      {renderSection('Security Settings', SECURITY_SETTINGS)}
    </div>
  );
}
