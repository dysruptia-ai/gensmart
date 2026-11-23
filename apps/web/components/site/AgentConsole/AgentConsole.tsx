'use client';

import { Fragment } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import ChatBubble from '../ChatBubble';
import styles from './AgentConsole.module.css';

const P = 'site.home.how';

const FILTERS: Array<{ key: string; count: number; on?: boolean }> = [
  { key: 'fAll', count: 14, on: true },
  { key: 'fNeed', count: 5 },
  { key: 'fMine', count: 2 },
  { key: 'fClosed', count: 4 },
];

const AGENTS: Array<{ key: string; count: number; tone: 'green' | 'blue' | 'amber' }> = [
  { key: 'agentSales', count: 8, tone: 'green' },
  { key: 'agentSupport', count: 4, tone: 'blue' },
  { key: 'agentBookings', count: 2, tone: 'amber' },
];

/**
 * Conversación de ejemplo. El marco (filtros, agentes, rótulos) es siempre el mismo;
 * esto es lo que cambia de una página a otra. Las claves de texto van completas.
 */
export interface ConsoleExample {
  /** Iniciales del avatar (decorativas). */
  initials: string;
  nameKey: string;
  metaKey: string;
  summaryKey: string;
  bubbles: ReadonlyArray<{ key: string; out: boolean }>;
  /** Puntaje del lead, de 0 a 10. */
  score: number;
  data: ReadonlyArray<{ labelKey: string; valueKey: string }>;
  /** Lo que hizo el agente, en orden. */
  didKeys: readonly string[];
}

/** Ejemplo del home: Laura Gómez, agente de ventas, pago enviado. */
export const SALES_EXAMPLE: ConsoleExample = {
  initials: 'LG',
  nameKey: `${P}.chatName`,
  metaKey: `${P}.chatMeta`,
  summaryKey: `${P}.summary`,
  bubbles: [
    { key: `${P}.b1`, out: false },
    { key: `${P}.b2`, out: true },
    { key: `${P}.b3`, out: false },
    { key: `${P}.b4`, out: true },
  ],
  score: 8.4,
  data: [
    { labelKey: `${P}.leadChannel`, valueKey: `${P}.leadChannelValue` },
    { labelKey: `${P}.leadStage`, valueKey: `${P}.leadStageValue` },
    { labelKey: `${P}.leadValue`, valueKey: `${P}.leadValueValue` },
  ],
  didKeys: [`${P}.did1`, `${P}.did2`, `${P}.did3`, `${P}.did4`],
};

interface AgentConsoleProps {
  example?: ConsoleExample;
}

/** Vista de la bandeja de la plataforma (riel, hilo y contexto del lead). */
export default function AgentConsole({ example = SALES_EXAMPLE }: AgentConsoleProps) {
  const { t } = useTranslation();
  const scorePercent = Math.max(0, Math.min(100, example.score * 10));
  return (
    <div className={styles.frame} role="group" aria-label={t(`${P}.consoleLabel`)}>
      <div className={styles.top}>
        <span className={styles.dots} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className={styles.url}>{t(`${P}.consoleUrl`)}</span>
        <span className={styles.live}>{t(`${P}.consoleLive`)}</span>
      </div>

      <div className={styles.cols}>
        <div className={styles.rail}>
          <h4 className={styles.h6}>{t(`${P}.inboxTitle`)}</h4>
          <ul className={styles.railList}>
            {FILTERS.map((f) => (
              <li key={f.key} className={f.on ? styles.on : undefined}>
                {t(`${P}.${f.key}`)}
                <em>{f.count}</em>
              </li>
            ))}
          </ul>
          <h4 className={styles.h6}>{t(`${P}.agentsHeading`)}</h4>
          <ul className={styles.railList}>
            {AGENTS.map((a) => (
              <li key={a.key}>
                <i className={`${styles.agentDot} ${styles[a.tone]}`} aria-hidden="true" />
                {t(`${P}.${a.key}`)}
                <em>{a.count}</em>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.thread}>
          <div className={styles.threadTop}>
            <span className={styles.avatar} aria-hidden="true">
              {example.initials}
            </span>
            <div>
              <b>{t(example.nameKey)}</b>
              <small>{t(example.metaKey)}</small>
            </div>
          </div>
          <p className={styles.summary}>
            <span>{t(`${P}.summaryLabel`)}</span> {t(example.summaryKey)}
          </p>
          <div className={styles.msgs}>
            {example.bubbles.map((b) => (
              <ChatBubble key={b.key} direction={b.out ? 'out' : 'in'} className={styles.bubble}>
                {t(b.key)}
              </ChatBubble>
            ))}
          </div>
          <p className={styles.composer}>{t(`${P}.composer`)}</p>
        </div>

        <div className={styles.ctx}>
          <div className={styles.ctxLead}>
            <h4 className={styles.h6}>{t(`${P}.leadStatus`)}</h4>
            <div className={styles.score}>
              <strong>
                <span className={styles.srOnly}>{t(`${P}.scoreLabel`)}: </span>
                {example.score}
              </strong>
              <span className={styles.bar} aria-hidden="true">
                <i style={{ width: `${scorePercent}%` }} />
              </span>
            </div>
            <dl className={styles.data}>
              {example.data.map((row) => (
                <Fragment key={row.labelKey}>
                  <dt>{t(row.labelKey)}</dt>
                  <dd>{t(row.valueKey)}</dd>
                </Fragment>
              ))}
            </dl>
          </div>
          <div className={styles.ctxDid}>
            <h4 className={styles.h6}>{t(`${P}.didTitle`)}</h4>
            <ol className={styles.did}>
              {example.didKeys.map((k) => (
                <li key={k}>{t(k)}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
