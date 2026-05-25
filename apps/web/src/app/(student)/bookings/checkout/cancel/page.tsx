import Link from 'next/link';

export default function CheckoutCancelPage() {
  return (
    <div style={{ maxWidth: '480px', margin: '80px auto', padding: '32px', textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>✕</div>
      <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Payment Cancelled</h1>
      <p style={{ color: '#555', marginBottom: '24px', fontSize: '15px' }}>
        Your booking was not completed. Your seat hold will expire shortly.
      </p>
      <Link
        href="/classes"
        style={{
          display: 'inline-block',
          padding: '10px 24px',
          backgroundColor: '#1a1a2e',
          color: '#fff',
          borderRadius: '4px',
          textDecoration: 'none',
          fontSize: '14px',
          marginRight: '12px',
        }}
      >
        Back to Classes
      </Link>
      <Link
        href="/bookings"
        style={{
          display: 'inline-block',
          padding: '10px 24px',
          backgroundColor: 'transparent',
          color: '#555',
          borderRadius: '4px',
          textDecoration: 'none',
          fontSize: '14px',
          border: '1px solid #ddd',
        }}
      >
        My Bookings
      </Link>
    </div>
  );
}
