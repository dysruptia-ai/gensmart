export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF8F5' }}>
      <div style={{ width: '100%', maxWidth: '440px', padding: '2rem', background: '#fff', borderRadius: '0.75rem', boxShadow: '0 4px 6px rgba(0,0,0,0.07)' }}>
        {children}
      </div>
    </div>
  );
}
