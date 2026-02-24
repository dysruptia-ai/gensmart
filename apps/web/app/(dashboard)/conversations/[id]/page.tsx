export default function ConversationDetailPage({ params }: { params: { id: string } }) {
  return <div><h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>Conversation</h1><p style={{ color: '#6B7280' }}>Conversation ID: {params.id}</p></div>;
}
