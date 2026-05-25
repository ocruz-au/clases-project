import Link from 'next/link';

const NAV_LINKS = [
  { href: '/admin/catalog', label: 'Catalog' },
  { href: '/admin/classes', label: 'Classes & Sessions' },
  { href: '/admin/instructors', label: 'Instructors' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/coupons', label: 'Coupons' },
  { href: '/admin/reports', label: 'Reports' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: '220px',
          backgroundColor: '#1a1a2e',
          color: '#fff',
          padding: '24px 0',
          flexShrink: 0,
        }}
      >
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid #2d2d4e' }}>
          <Link href="/admin" style={{ color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '16px' }}>
            Admin Panel
          </Link>
        </div>
        <nav style={{ paddingTop: '16px' }}>
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={{
                display: 'block',
                padding: '10px 20px',
                color: '#ccc',
                textDecoration: 'none',
                fontSize: '14px',
                transition: 'background 0.1s',
              }}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div style={{ position: 'absolute', bottom: '24px', padding: '0 20px' }}>
          <Link href="/" style={{ color: '#888', fontSize: '13px', textDecoration: 'none' }}>
            ← Back to Site
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, backgroundColor: '#f7f8fa', minHeight: '100vh', overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
