import Link from 'next/link';

export default function CheckoutSuccessPage() {
  return (
    <div style={{ maxWidth: '480px', margin: '80px auto', padding: '32px', textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
      <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Booking Confirmed!</h1>
      <p style={{ color: '#555', marginBottom: '24px', fontSize: '15px' }}>
        Your payment was successful. A confirmation email has been sent to you.
      </p>
      <Link
        href="/bookings"
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
        View My Bookings
      </Link>
      <Link
        href="/classes"
        style={{
          display: 'inline-block',
          padding: '10px 24px',
          backgroundColor: 'transparent',
          color: '#1a1a2e',
          borderRadius: '4px',
          textDecoration: 'none',
          fontSize: '14px',
          border: '1px solid #1a1a2e',
        }}
      >
        Browse More Classes
      </Link>
    </div>
  );
}
