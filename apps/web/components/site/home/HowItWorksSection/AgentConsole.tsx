'use client';

import { useTranslation } from '@/hooks/useTranslation';
import ChatBubble from '../../ChatBubble';
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

const BUBBLES: Array<{ key: string; out: boolean }> = [
  { key: 'b1', out: false },
  { key: 'b2', out: true },
  { key: 'b3', out: false },
  { key: 'b4', out: true },
];

const DID = ['did1', 'did2', 'did3', 'did4'] as const;
const SCORE = 8.4;

/** Vista de la bandeja de la plataforma (riel, hilo y contexto del lead). */
export default function AgentConsole() {
  const { t } = useTranslation();
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
              LG
            </span>
            <div>
              <b>{t(`${P}.chatName`)}</b>
              <small>{t(`${P}.chatMeta`)}</small>
            </div>
          </div>
          <p className={styles.summary}>
            <span>{t(`${P}.summaryLabel`)}</span> {t(`${P}.summary`)}
          </p>
          <div className={styles.msgs}>
            {BUBBLES.map((b) => (
              <ChatBubble key={b.key} direction={b.out ? 'out' : 'in'} className={styles.bubble}>
                {t(`${P}.${b.key}`)}
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
                {SCORE}
              </strong>
              <span className={styles.bar} aria-hidden="true">
                <i />
              </span>
            </div>
            <dl className={styles.data}>
              <dt>{t(`${P}.leadChannel`)}</dt>
              <dd>{t(`${P}.leadChannelValue`)}</dd>
              <dt>{t(`${P}.leadStage`)}</dt>
              <dd>{t(`${P}.leadStageValue`)}</dd>
              <dt>{t(`${P}.leadValue`)}</dt>
              <dd>{t(`${P}.leadValueValue`)}</dd>
            </dl>
          </div>
          <div className={styles.ctxDid}>
            <h4 className={styles.h6}>{t(`${P}.didTitle`)}</h4>
            <ol className={styles.did}>
              {DID.map((k) => (
                <li key={k}>{t(`${P}.${k}`)}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
