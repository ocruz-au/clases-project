import Link from 'next/link';

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <nav
        style={{
          width: '220px',
          backgroundColor: '#1a1a2e',
          color: '#fff',
          padding: '24px 0',
          flexShrink: 0,
        }}
      >
        <div style={{ padding: '0 20px 24px', fontSize: '16px', fontWeight: 'bold', borderBottom: '1px solid #333' }}>
          Instructor Portal
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: '16px 0' }}>
          {[
            { href: '/instructor', label: 'Dashboard' },
            { href: '/instructor/sessions', label: 'My Sessions' },
          ].map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                style={{
                  display: 'block',
                  padding: '10px 20px',
                  color: '#ccc',
                  textDecoration: 'none',
                  fontSize: '14px',
                }}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <main style={{ flex: 1, backgroundColor: '#f9fafb', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
