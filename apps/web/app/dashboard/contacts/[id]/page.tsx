export default function ContactDetailPage({ params }: { params: { id: string } }) {
  return <div><h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>Contact</h1><p style={{ color: '#6B7280' }}>Contact ID: {params.id}</p></div>;
}
