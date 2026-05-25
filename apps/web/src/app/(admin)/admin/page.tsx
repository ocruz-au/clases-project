import Link from 'next/link';

const QUICK_LINKS = [
  { href: '/admin/catalog', label: 'Manage Catalog', desc: 'Categories, locations, rooms' },
  { href: '/admin/classes', label: 'Classes & Sessions', desc: 'Create classes and generate schedules' },
  { href: '/admin/instructors', label: 'Instructors', desc: 'Manage instructor profiles' },
  { href: '/admin/users', label: 'Users', desc: 'User accounts and roles' },
  { href: '/admin/payments', label: 'Payments', desc: 'Transactions and refunds' },
];

export default function AdminDashboardPage() {
  return (
    <div style={{ padding: '32px' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Admin Dashboard</h1>
      <p style={{ color: '#666', marginBottom: '32px' }}>Manage your class booking platform</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
        {QUICK_LINKS.map(({ href, label, desc }) => (
          <Link
            key={href}
            href={href}
            style={{
              display: 'block',
              padding: '20px',
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              textDecoration: 'none',
              color: 'inherit',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <p style={{ fontWeight: 600, margin: '0 0 6px', fontSize: '15px', color: '#1a1a2e' }}>{label}</p>
            <p style={{ margin: 0, fontSize: '13px', color: '#888' }}>{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
