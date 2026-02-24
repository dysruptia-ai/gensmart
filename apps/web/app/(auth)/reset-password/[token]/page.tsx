export default function ResetPasswordPage({ params }: { params: { token: string } }) {
  return <div><h1 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>Set New Password</h1><p style={{ color: '#6B7280' }}>Token: {params.token}</p></div>;
}
