export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-layout">
      <nav style={{ padding: '1rem', borderBottom: '1px solid #E5E0DB', background: '#fff' }}>
        <strong>GenSmart</strong>
      </nav>
      <main>{children}</main>
      <footer style={{ padding: '2rem', borderTop: '1px solid #E5E0DB', textAlign: 'center', color: '#6B7280' }}>
        © 2026 GenSmart. All rights reserved.
      </footer>
    </div>
  );
}
