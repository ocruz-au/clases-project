'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Room { id: string; name: string; location: { name: string } }
interface Instructor { id: string; user: { name: string } }

interface Props {
  classId: string;
  rooms: unknown[];
  instructors: unknown[];
}

export default function ScheduleGeneratorClient({ classId, rooms, instructors }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    roomId: '',
    instructorId: '',
    rrule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=10',
    startTimeLocal: '09:00',
    durationMin: '60',
    activeFrom: '',
    activeUntil: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // 1. Create availability rule
      const ruleRes = await fetch('/api/v1/admin/availability-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          classId,
          roomId: form.roomId,
          instructorId: form.instructorId,
          rrule: form.rrule,
          startTimeLocal: form.startTimeLocal,
          durationMin: parseInt(form.durationMin),
          activeFrom: form.activeFrom,
          activeUntil: form.activeUntil || null,
        }),
      });
      if (!ruleRes.ok) throw new Error('Failed to create availability rule');
      const rule = await ruleRes.json() as { id: string };

      // 2. Generate sessions from rule
      const genRes = await fetch(`/api/v1/admin/availability-rules/${rule.id}/generate`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!genRes.ok) throw new Error('Failed to generate sessions');
      const genResult = await genRes.json() as { created: number };
      setResult(genResult);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = { padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '100%', fontSize: '14px' };
  const labelStyle = { display: 'block', fontSize: '13px', color: '#555', marginBottom: '4px' };

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      {result && (
        <div style={{ padding: '12px', backgroundColor: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: '6px' }}>
          <p style={{ color: '#276749', margin: 0 }}>Generated {result.created} session{result.created !== 1 ? 's' : ''} successfully!</p>
        </div>
      )}
      {error && <p style={{ color: '#e53e3e', fontSize: '14px' }}>{error}</p>}

      <div>
        <label style={labelStyle}>Room *</label>
        <select value={form.roomId} onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))} style={inputStyle}>
          <option value="">Select room…</option>
          {(rooms as Room[]).map((r) => (
            <option key={r.id} value={r.id}>{r.location.name} — {r.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Instructor *</label>
        <select value={form.instructorId} onChange={(e) => setForm((f) => ({ ...f, instructorId: e.target.value }))} style={inputStyle}>
          <option value="">Select instructor…</option>
          {(instructors as Instructor[]).map((i) => (
            <option key={i.id} value={i.id}>{i.user.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>RRULE (iCal recurrence)</label>
        <input value={form.rrule} onChange={(e) => setForm((f) => ({ ...f, rrule: e.target.value }))} style={inputStyle} />
        <p style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>e.g. FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={labelStyle}>Start time (Perth local)</label>
          <input type="time" value={form.startTimeLocal} onChange={(e) => setForm((f) => ({ ...f, startTimeLocal: e.target.value }))} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Duration (minutes)</label>
          <input type="number" value={form.durationMin} onChange={(e) => setForm((f) => ({ ...f, durationMin: e.target.value }))} style={inputStyle} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={labelStyle}>Active from *</label>
          <input type="date" value={form.activeFrom} onChange={(e) => setForm((f) => ({ ...f, activeFrom: e.target.value }))} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Active until (optional)</label>
          <input type="date" value={form.activeUntil} onChange={(e) => setForm((f) => ({ ...f, activeUntil: e.target.value }))} style={inputStyle} />
        </div>
      </div>

      <button
        onClick={() => void handleGenerate()}
        disabled={loading || !form.roomId || !form.instructorId || !form.activeFrom}
        style={{ padding: '12px', backgroundColor: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '15px', cursor: 'pointer' }}
      >
        {loading ? 'Generating…' : 'Generate Sessions'}
      </button>
    </div>
  );
}
