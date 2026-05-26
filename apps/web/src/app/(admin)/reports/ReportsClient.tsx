'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props {
  from: string;
  to: string;
  bookings: { total: number } | null;
  revenue: { totalCents: number; count: number } | null;
  attendance: { CONFIRMED: number; ATTENDED: number; NO_SHOW: number } | null;
  cancellations: { total: number } | null;
  waitlist: { total: number; converted: number; rate: number } | null;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      style={{
        backgroundColor: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '20px 24px',
        flex: '1 1 180px',
        minWidth: '160px',
      }}
    >
      <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#888', fontWeight: 500 }}>{label}</p>
      <p style={{ margin: 0, fontSize: '26px', fontWeight: 700, color: '#1a1a2e' }}>{value}</p>
      {sub && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666' }}>{sub}</p>}
    </div>
  );
}

function downloadCsv(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]!);
  const rows = data.map((row) => headers.map((h) => String(row[h] ?? '')).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsClient({ from, to, bookings, revenue, attendance, cancellations, waitlist }: Props) {
  const router = useRouter();
  const [fromInput, setFromInput] = useState(from);
  const [toInput, setToInput] = useState(to);

  function applyRange() {
    router.push(`?from=${fromInput}&to=${toInput}`);
  }

  const inputStyle = {
    padding: '7px 10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
  };

  const csvData = [
    { metric: 'Confirmed Bookings', value: bookings?.total ?? 0 },
    { metric: 'Revenue (cents)', value: revenue?.totalCents ?? 0 },
    { metric: 'Revenue (AUD)', value: revenue ? `$${(revenue.totalCents / 100).toFixed(2)}` : '—' },
    { metric: 'Payment Count', value: revenue?.count ?? 0 },
    { metric: 'Attended', value: attendance?.ATTENDED ?? 0 },
    { metric: 'No-Show', value: attendance?.NO_SHOW ?? 0 },
    { metric: 'Still Confirmed', value: attendance?.CONFIRMED ?? 0 },
    { metric: 'Cancellations', value: cancellations?.total ?? 0 },
    { metric: 'Waitlist Total', value: waitlist?.total ?? 0 },
    { metric: 'Waitlist Converted', value: waitlist?.converted ?? 0 },
    { metric: 'Conversion Rate (%)', value: waitlist?.rate ?? 0 },
  ];

  return (
    <div>
      {/* Date range picker */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ fontSize: '13px', color: '#555' }}>From</label>
          <input type="date" value={fromInput} onChange={(e) => setFromInput(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ fontSize: '13px', color: '#555' }}>To</label>
          <input type="date" value={toInput} onChange={(e) => setToInput(e.target.value)} style={inputStyle} />
        </div>
        <button
          onClick={applyRange}
          style={{ padding: '7px 18px', backgroundColor: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
        >
          Apply
        </button>
        <button
          onClick={() => downloadCsv(csvData, `report-${from}-${to}.csv`)}
          style={{ padding: '7px 18px', backgroundColor: '#fff', color: '#555', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
        >
          Download CSV
        </button>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' }}>
        <StatCard label="Confirmed Bookings" value={String(bookings?.total ?? '—')} />
        <StatCard
          label="Revenue"
          value={revenue ? `$${(revenue.totalCents / 100).toFixed(2)}` : '—'}
          sub={revenue ? `${revenue.count} payment(s)` : undefined}
        />
        <StatCard label="Cancellations" value={String(cancellations?.total ?? '—')} />
        <StatCard
          label="Waitlist Conversion"
          value={waitlist ? `${waitlist.rate}%` : '—'}
          sub={waitlist ? `${waitlist.converted} / ${waitlist.total} converted` : undefined}
        />
      </div>

      {/* Attendance breakdown */}
      {attendance && (
        <div
          style={{
            backgroundColor: '#fff',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            padding: '20px 24px',
            marginBottom: '28px',
          }}
        >
          <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 16px', color: '#1a1a2e' }}>
            Attendance Breakdown
          </h3>
          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            {[
              { label: 'Attended', value: attendance.ATTENDED, color: '#38a169' },
              { label: 'No-Show', value: attendance.NO_SHOW, color: '#e53e3e' },
              { label: 'Still Confirmed', value: attendance.CONFIRMED, color: '#3182ce' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>{label}</p>
                <p style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: 700, color }}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p style={{ fontSize: '12px', color: '#999' }}>
        Showing data for Perth local dates {from} → {to} (UTC+8).
      </p>
    </div>
  );
}
