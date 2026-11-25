'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import MockWindow from '../ProductSubpage/MockWindow';
import { cx } from '../ProductSubpage/cx';

const P = 'site.productBooking.steps';

/** Paso 1: las reglas de un calendario. El domingo (último día) está apagado. */
export default function CalendarRulesMock() {
  const { t } = useSiteTranslation();
  const days = t(`${P}.daysValue`).split(',');
  const rows = [
    { key: 'hours', value: t(`${P}.hoursValue`) },
    { key: 'length', value: t(`${P}.lengthValue`) },
    { key: 'gap', value: t(`${P}.gapValue`), hot: true },
    { key: 'notice', value: t(`${P}.noticeValue`) },
    { key: 'tz', value: t(`${P}.tzValue`) },
  ];
  return (
    <MockWindow label={t(`${P}.s1Label`)} bar={t(`${P}.s1Bar`)} variant={['dy-cfg']}>
      <ul className={cx('dy-f')}>
        <li>
          <span>{t(`${P}.days`)}</span>
          <b className={cx('dy-days')}>
            <span className={cx('srOnly')}>{t(`${P}.daysSr`)}</span>
            {days.map((d, i) => (
              <i key={i} aria-hidden="true" className={i === days.length - 1 ? cx('off') : undefined}>
                {d}
              </i>
            ))}
          </b>
        </li>
        {rows.map((r) => (
          <li key={r.key} className={r.hot ? cx('hot') : undefined}>
            <span>{t(`${P}.${r.key}`)}</span>
            <b>{r.value}</b>
          </li>
        ))}
      </ul>
    </MockWindow>
  );
}
