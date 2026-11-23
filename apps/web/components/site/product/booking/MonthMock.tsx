'use client';

import { useTranslation } from '@/hooks/useTranslation';
import MockWindow from '../ProductSubpage/MockWindow';
import { cx } from '../ProductSubpage/cx';

const P = 'site.productBooking.steps';

/** Citas por día de noviembre de 2026 (empieza en domingo; los domingos, cerrado). */
const DOTS = [0, 0, 2, 1, 3, 2, 3, 0, 0, 1, 2, 2, 1, 3, 0, 0, 2, 1, 3, 2, 3, 0, 0, 1, 2, 1, 2, 3, 0, 0];
const SELECTED = 21;

/** Paso 4: la vista mensual. Filtros y flechas son texto: ilustración, no controles. */
export default function MonthMock() {
  const { t } = useTranslation();
  const weekdays = t(`${P}.weekdays`).split(',');
  return (
    <MockWindow label={t(`${P}.s4Label`)} bar={t(`${P}.s4Bar`)} variant={['dy-mon']}>
      <div className={cx('dy-mh')}>
        <div className={cx('dy-fl')}>
          <span className={cx('fake')}>{t(`${P}.allCalendars`)}</span>
          <span className={cx('fake')}>{t(`${P}.allStatuses`)}</span>
        </div>
        <div className={cx('dy-mt')}>
          <i aria-hidden="true">‹</i>
          <b>{t(`${P}.month`)}</b>
          <i aria-hidden="true">›</i>
        </div>
      </div>
      <div className={cx('dy-wd')} aria-hidden="true">
        {weekdays.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className={cx('dy-g')} aria-hidden="true">
        {DOTS.map((n, i) => {
          const day = i + 1;
          return (
            <span key={day} className={cx('d', i % 7 === 0 && 'off', day === SELECTED && 'sel')}>
              <b>{day}</b>
              <em>
                {Array.from({ length: n }, (_, k) => (
                  <i key={k} />
                ))}
              </em>
            </span>
          );
        })}
      </div>
    </MockWindow>
  );
}
