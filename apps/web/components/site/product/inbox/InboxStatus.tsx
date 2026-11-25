'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import Container from '../../Container';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import ChannelIcon from '../ProductSubpage/ChannelIcon';
import { cx } from '../ProductSubpage/cx';
import { CONVERSATIONS, type ConversationStatus } from './inboxData';
import StatusPill from './StatusPill';

const P = 'site.productInbox.status';
const STATUSES: readonly ConversationStatus[] = ['active', 'human', 'closed'];

/** Estados de la conversación: maqueta de búsqueda y filtros, y los tres estados (`dl`). */
export default function InboxStatus() {
  const { t } = useSiteTranslation();
  const chips = [
    { label: t(`${P}.search`), value: t('site.productInbox.hero.search'), find: true },
    { label: t(`${P}.status`), value: t(`${P}.allStatuses`) },
    { label: t(`${P}.channel`), value: t(`${P}.allChannels`) },
    { label: t(`${P}.agent`), value: t(`${P}.allAgents`) },
  ];
  return (
    <Section surface="alt" rhythm="l">
      <Container>
        <SectionHead title={t(`${P}.title`)} lead={t(`${P}.lead`)} />
        <div className={cx('bx-tbl')} role="group" aria-label={t(`${P}.mockLabel`)}>
          <div className={cx('bx-tbl-f')}>
            {chips.map((c) => (
              <span key={c.label} className={cx('bx-chip', 'fake', c.find && 'bx-find')}>
                <small>{c.label}</small>
                <b>{c.value}</b>
              </span>
            ))}
          </div>
          <ul className={cx('bx-rows')}>
            {CONVERSATIONS.map((c) => (
              <li key={c.name}>
                <span className={cx('bx-who')}>
                  <ChannelIcon channel={c.channel} />
                  <b>{c.name}</b>
                </span>
                <span className={cx('bx-last')}>{t(c.lastKey)}</span>
                <span className={cx('bx-ag')}>{t(c.agentKey)}</span>
                <StatusPill status={c.status} />
                <time>{t(c.agoKey)}</time>
              </li>
            ))}
          </ul>
        </div>
        <dl className={cx('bx-flow')}>
          {STATUSES.map((s) => (
            <div key={s}>
              <dt>
                <StatusPill status={s} />
              </dt>
              <dd>
                <p>{t(`${P}.${s}Desc`)}</p>
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </Section>
  );
}
