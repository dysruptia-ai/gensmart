export default async function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div><h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>Conversation</h1><p style={{ color: '#6B7280' }}>Conversation ID: {id}</p></div>;
}
