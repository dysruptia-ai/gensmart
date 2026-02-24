export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#FAF8F5' }}>
      <aside style={{ width: '260px', background: '#F5F0EB', borderRight: '1px solid #E5E0DB', padding: '1rem', flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '1.25rem', marginBottom: '2rem', color: '#25D366' }}>GenSmart</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Agents', path: '/dashboard/agents' },
            { label: 'Conversations', path: '/dashboard/conversations' },
            { label: 'Contacts', path: '/dashboard/contacts' },
            { label: 'Funnel', path: '/dashboard/funnel' },
            { label: 'Calendar', path: '/dashboard/calendar' },
            { label: 'Billing', path: '/dashboard/billing' },
            { label: 'Settings', path: '/dashboard/settings' },
          ].map(item => (
            <a key={item.path} href={item.path} style={{ padding: '0.5rem 0.75rem', borderRadius: '0.375rem', color: '#1A1A1A', textDecoration: 'none' }}>{item.label}</a>
          ))}
        </nav>
      </aside>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header style={{ height: '64px', borderBottom: '1px solid #E5E0DB', background: '#fff', display: 'flex', alignItems: 'center', padding: '0 1.5rem' }}>
          <span style={{ marginLeft: 'auto', color: '#6B7280' }}>Dashboard Header</span>
        </header>
        <main style={{ flex: 1, padding: '1.5rem' }}>{children}</main>
      </div>
    </div>
  );
}
