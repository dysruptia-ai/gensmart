'use client';

import { Check } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import ChannelIcon, { MOCK_CHANNELS } from '../ProductSubpage/ChannelIcon';
import { useChannelName } from '../ProductSubpage/useChannelName';
import MockChat from '../ProductSubpage/MockChat';
import MockWindow from '../ProductSubpage/MockWindow';
import { cx } from '../ProductSubpage/cx';
import { valentinaThread } from '../ProductSubpage/valentina';
import { CHANNEL_COUNT } from '../productData';

const H = 'site.productAgents.hero';

/** Hero de Agentes: la ficha del agente inmobiliario y su conversación con Valentina. */
export default function AgentBuilderMock() {
  const { t } = useTranslation();
  const channelName = useChannelName();
  const tabs = ['tabInstructions', 'tabKnowledge', 'tabActions'];
  return (
    <MockWindow label={t(`${H}.mockLabel`)} bar={t(`${H}.bar`)}>
      <div className={cx('ag-body')}>
        <div className={cx('ag-build')}>
          <div className={cx('ag-who')}>
            <span className={cx('ag-av')} aria-hidden="true">
              {t(`${H}.initial`)}
            </span>
            <div>
              <b>{t(`${H}.name`)}</b>
              <small>{t(`${H}.role`)}</small>
            </div>
            <em>
              <u aria-hidden="true" />
              {t(`${H}.live`)}
            </em>
          </div>
          <div className={cx('ag-tabs')}>
            {tabs.map((k, i) => (
              <span key={k} className={i === 0 ? cx('on') : undefined}>
                {t(`${H}.${k}`)}
              </span>
            ))}
            <span>
              {t(`${H}.tabChannels`)}
              {/* Corrección: el diseño dice 7; los canales salen de PLAN_LIMITS */}
              <b>{CHANNEL_COUNT}</b>
            </span>
          </div>
          <dl>
            {(['goal', 'tone', 'rule'] as const).map((k) => (
              <div key={k}>
                <dt>{t(`${H}.${k}`)}</dt>
                <dd>{t(`${H}.${k}Value`)}</dd>
              </div>
            ))}
          </dl>
          <div className={cx('ag-chan-h')} aria-hidden="true">
            {t(`${H}.channels`)}
          </div>
          <ul className={cx('ag-chan')} aria-label={t(`${H}.channelsLabel`)}>
            {MOCK_CHANNELS.map((c) => (
              <li key={c}>
                <ChannelIcon channel={c} />
                <span>{channelName(c)}</span>
                <u aria-hidden="true" />
              </li>
            ))}
          </ul>
        </div>
        <div className={cx('ag-chat')}>
          <div className={cx('ag-chat-h')}>
            <ChannelIcon channel="whatsapp" />
            <div>
              <b>Valentina</b>
              <small>{t(`${H}.chatVia`)}</small>
            </div>
          </div>
          <MockChat
            messages={valentinaThread(t)}
            insertAfter={{
              index: 2,
              node: (
                <ul className={cx('ag-acts')} aria-label={t(`${H}.actsLabel`)}>
                  {[1, 2, 3].map((i) => (
                    <li key={i} className={i === 3 ? cx('hi') : undefined}>
                      <Check strokeWidth={2.4} aria-hidden="true" />
                      {t(`${H}.act${i}`)}
                    </li>
                  ))}
                </ul>
              ),
            }}
          />
        </div>
      </div>
    </MockWindow>
  );
}
