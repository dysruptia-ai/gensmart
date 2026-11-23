import { notFound } from 'next/navigation';

// /widget with no agentId has nothing to render — serve a clean 404 instead of
// falling through to whatever default behavior would otherwise apply.
export default function WidgetIndexPage(): never {
  notFound();
}
