'use client';

import { useTranslation } from '@/hooks/useTranslation';
import ChannelIcon from '../ProductSubpage/ChannelIcon';
import MockChat from '../ProductSubpage/MockChat';
import MockWindow from '../ProductSubpage/MockWindow';
import { cx } from '../ProductSubpage/cx';
import { valentinaThread } from '../ProductSubpage/valentina';
import { CONVERSATIONS, HERO_ORDER } from './inboxData';
import StatusPill from './StatusPill';

const H = 'site.productInbox.hero';
const S = 'site.productShared';

/** Hero de la bandeja: la lista con pestañas de estado, el hilo de Valentina y su contacto. */
export default function InboxMock() {
  const { t } = useTranslation();
  const list = HERO_ORDER.map((n) => CONVERSATIONS.find((c) => c.name === n)).filter(
    (c): c is (typeof CONVERSATIONS)[number] => Boolean(c)
  );
  const filters = [t(`${H}.all`), t(`${H}.active`), t(`${H}.closed`), t(`${S}.status.human`)];
  return (
    <MockWindow label={t(`${H}.mockLabel`)} bar={t(`${H}.bar`)} variant={['bx-win']}>
      <div className={cx('bx-body')}>
        <div className={cx('bx-list')}>
          <span className={cx('bx-search', 'fake')}>{t(`${H}.search`)}</span>
          <div className={cx('bx-filters')}>
            {filters.map((f, i) => (
              <span key={f} className={cx('fake', i === 0 && 'on')}>
                {f}
              </span>
            ))}
          </div>
          <ul aria-label={t(`${H}.listLabel`)}>
            {list.map((c, i) => (
              <li key={c.name} className={i === 0 ? cx('on') : undefined}>
                <ChannelIcon channel={c.channel} />
                <div>
                  <b>{c.name}</b>
                  <small>{t(c.lastKey)}</small>
                </div>
                <StatusPill status={c.status} />
              </li>
            ))}
          </ul>
        </div>
        <div className={cx('bx-thread')}>
          <div className={cx('bx-th-h')}>
            <b>Valentina</b>
            <span className={cx('bx-route')}>Instagram</span>
            <StatusPill status="active" />
            <span className={cx('bx-take', 'fake')}>{t(`${H}.take`)}</span>
          </div>
          <MockChat messages={valentinaThread(t)} />
        </div>
        <div className={cx('bx-side')}>
          <small>{t(`${H}.contact`)}</small>
          <dl>
            <div>
              <dt>{t(`${S}.fields.stage`)}</dt>
              <dd>{t(`${S}.stage.opportunity`)}</dd>
            </div>
            <div>
              <dt>{t(`${S}.fields.score`)}</dt>
              <dd className={cx('bx-sc')}>6 / 10</dd>
            </div>
            <div>
              <dt>{t(`${S}.fields.agent`)}</dt>
              <dd>{t(`${S}.agent.realEstate`)}</dd>
            </div>
          </dl>
          <small className={cx('bx-vh')}>{t(`${H}.vars`)}</small>
          <dl>
            <div>
              <dt>{t(`${S}.fields.downPayment`)}</dt>
              <dd>{t(`${S}.fields.downPaymentValue`)}</dd>
            </div>
            <div>
              <dt>{t(`${H}.interest`)}</dt>
              <dd>{t(`${H}.interestValue`)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </MockWindow>
  );
}
