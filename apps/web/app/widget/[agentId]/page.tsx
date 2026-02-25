export default async function WidgetPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p>Widget for agent: {agentId}</p></div>;
}
