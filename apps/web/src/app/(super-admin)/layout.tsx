import Link from 'next/link';

const NAV_LINKS = [
  { href: '/super-admin/settings', label: 'Settings' },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
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
          <Link href="/super-admin" style={{ color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '16px' }}>
            Super Admin
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
              }}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div style={{ position: 'absolute', bottom: '24px', padding: '0 20px' }}>
          <Link href="/admin" style={{ color: '#888', fontSize: '13px', textDecoration: 'none' }}>
            ← Admin Panel
          </Link>
        </div>
      </aside>
      <main style={{ flex: 1, backgroundColor: '#f7f8fa', minHeight: '100vh', overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
