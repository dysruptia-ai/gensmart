export default function AgentDetailPage({ params }: { params: { id: string } }) {
  return <div><h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>Agent Editor</h1><p style={{ color: '#6B7280' }}>Agent ID: {params.id}</p></div>;
}
