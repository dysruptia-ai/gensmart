import { Fragment, type ReactNode } from 'react';
import ChatBubble from '../../ChatBubble';
import { cx, styles } from './cx';

export interface MockMessage {
  /** `in`: el cliente; `out`: el agente. */
  dir: 'in' | 'out';
  text: ReactNode;
}

interface MockChatProps {
  messages: readonly MockMessage[];
  /** Algo entre mensajes (p. ej. las acciones del agente), después del índice dado. */
  insertAfter?: { index: number; node: ReactNode };
}

/** Hilo de una conversación de ejemplo (design: `.ag-msgs`), con `ChatBubble`. */
export default function MockChat({ messages, insertAfter }: MockChatProps) {
  return (
    <div className={cx('ag-msgs')}>
      {messages.map((m, i) => (
        <Fragment key={i}>
          <ChatBubble direction={m.dir} className={styles.bubble}>
            {m.text}
          </ChatBubble>
          {insertAfter && insertAfter.index === i ? insertAfter.node : null}
        </Fragment>
      ))}
    </div>
  );
}
