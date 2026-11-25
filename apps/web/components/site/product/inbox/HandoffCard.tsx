'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import { cx } from '../ProductSubpage/cx';

const P = 'site.productInbox.handoff';
const S = 'site.productShared';

/** Tarjeta del traspaso a Camila (design: `.hoff`). Maqueta: grupo con nombre, sin controles. */
export default function HandoffCard() {
  const { t } = useSiteTranslation();
  const rows = [
    { label: t(`${P}.channel`), value: 'WhatsApp' },
    { label: t(`${S}.fields.stage`), value: t(`${S}.stage.opportunity`) },
    { label: t(`${S}.fields.score`), value: '5 / 10' },
    { label: t(`${P}.messages`), value: '17' },
  ];
  return (
    <div className={cx('hoff')} role="group" aria-label={t(`${P}.mockLabel`)}>
      <div className={cx('hoff-top')}>
        <i aria-hidden="true" />
        <span>{t(`${P}.heading`)}</span>
      </div>
      <div className={cx('hoff-body')}>
        <p className={cx('hoff-sum')}>{t(`${P}.summary`)}</p>
        <dl className={cx('hoff-rows')}>
          {rows.map((r) => (
            <div key={r.label}>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className={cx('hoff-foot')}>
        <span className={cx('hoff-av')} aria-hidden="true">
          CM
        </span>
        <span className={cx('hoff-who')}>
          <b>Camila M.</b>
          <span>{t(`${P}.role`)}</span>
        </span>
        <span className={cx('hoff-tag')}>{t(`${P}.tag`)}</span>
      </div>
    </div>
  );
}
