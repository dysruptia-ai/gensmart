import { Suspense } from 'react';
import InboxScreen from '@/components/app/Inbox/InboxScreen';

/**
 * La Bandeja (web-41). Vive en el layout para que `/dashboard/conversations` y
 * `/dashboard/conversations/[id]` compartan la misma pantalla: cambiar de conversación
 * solo cambia la URL (router.replace), sin desmontar la lista ni el riel.
 */
export default function ConversationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <InboxScreen />
      </Suspense>
      {children}
    </>
  );
}
