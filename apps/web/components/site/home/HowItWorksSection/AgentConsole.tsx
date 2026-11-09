'use client';

import {
  ArrowRight,
  CalendarDays,
  ChartLine,
  Check,
  Eye,
  Lightbulb,
  MessageCircle,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import ChatBubble from '../../ChatBubble';
import styles from './AgentConsole.module.css';

const P = 'site.home.how';

const AGENTS: Array<{ nameKey: string; channelKey: string | null; channel: string; icon: LucideIcon; on?: boolean }> = [
  { nameKey: 'agentSales', channelKey: null, channel: 'WhatsApp', icon: ChartLine, on: true },
  { nameKey: 'agentSupport', channelKey: 'chWeb', channel: '', icon: MessageCircle },
  { nameKey: 'agentBookings', channelKey: null, channel: 'Instagram', icon: CalendarDays },
];

const BUBBLES: Array<{ key: string; out: boolean }> = [
  { key: 'b1', out: false },
  { key: 'b2', out: true },
  { key: 'b3', out: false },
  { key: 'b4', out: true },
];

const STEPS: Array<{ n: number; icon: LucideIcon }> = [
  { n: 1, icon: Eye },
  { n: 2, icon: Lightbulb },
  { n: 3, icon: SlidersHorizontal },
  { n: 4, icon: Check },
];

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
        <aside className={styles.rail}>
          <h4 className={styles.h4}>{t(`${P}.agentsTitle`)}</h4>
          {AGENTS.map((a) => {
            const Icon = a.icon;
            return (
              <div key={a.nameKey} className={`${styles.agent} ${a.on ? styles.agentOn : ''}`}>
                <span className={styles.agentIcon}>
                  <Icon size={13} aria-hidden="true" />
                </span>
                <span className={styles.agentName}>{t(`${P}.${a.nameKey}`)}</span>
                <span className={styles.agentChannel}>
                  {a.channelKey ? t(`${P}.${a.channelKey}`) : a.channel}
                </span>
              </div>
            );
          })}
        </aside>

        <section className={styles.chat}>
          <div className={styles.chatHead}>
            <span className={styles.avatar}>LG</span>
            <b className={styles.chatName}>{t(`${P}.chatName`)}</b>
            <span className={styles.chatChannel}>
              <MessageCircle size={12} aria-hidden="true" />
              {t(`${P}.chatChannel`)}
            </span>
          </div>
          {BUBBLES.map((b) => (
            <ChatBubble key={b.key} direction={b.out ? 'out' : 'in'}>
              {t(`${P}.${b.key}`)}
            </ChatBubble>
          ))}
          <div className={styles.input}>
            <span className={styles.typing} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className={styles.typingText}>{t(`${P}.typing`)}</span>
            <span className={styles.send} aria-hidden="true">
              <ArrowRight size={14} />
            </span>
          </div>
        </section>

        <aside className={styles.trace}>
          <h4 className={styles.h4}>{t(`${P}.insideTitle`)}</h4>
          <ol className={styles.loop}>
            {STEPS.map(({ n, icon: Icon }) => (
              <li key={n}>
                <span className={styles.stepIcon}>
                  <Icon size={12} aria-hidden="true" />
                </span>
                <div>
                  <b>{t(`${P}.i${n}Title`)}</b>
                  <span>{t(`${P}.i${n}Desc`)}</span>
                </div>
              </li>
            ))}
          </ol>
          <div className={styles.lead}>
            <div className={styles.leadTop}>
              <span>{t(`${P}.leadTitle`)}</span>
              <b className={styles.score}>8.4</b>
            </div>
            <dl className={styles.leadData}>
              <dt>{t(`${P}.leadChannel`)}</dt>
              <dd>{t(`${P}.leadChannelValue`)}</dd>
              <dt>{t(`${P}.leadStage`)}</dt>
              <dd>{t(`${P}.leadStageValue`)}</dd>
              <dt>{t(`${P}.leadValue`)}</dt>
              <dd>{t(`${P}.leadValueValue`)}</dd>
            </dl>
          </div>
        </aside>
      </div>

      <div className={styles.foot}>
        <span>
          <b>4</b> {t(`${P}.foot1`)}
        </span>
        <span>
          <b>12 s</b> {t(`${P}.foot2`)}
        </span>
        <span>
          <b>0</b> {t(`${P}.foot3`)}
        </span>
        <span className={styles.footNote}>{t(`${P}.footNote`)}</span>
      </div>
    </div>
  );
}
