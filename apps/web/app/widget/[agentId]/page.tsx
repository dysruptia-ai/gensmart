export default function WidgetPage({ params }: { params: { agentId: string } }) {
  return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p>Widget for agent: {params.agentId}</p></div>;
}
