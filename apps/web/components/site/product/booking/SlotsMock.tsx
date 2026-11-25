'use client';

import { Fragment } from 'react';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import { cx } from '../ProductSubpage/cx';

const P = 'site.productBooking.steps';

/** Los 12 espacios de 9:00 a 17:00 (30 min + 10 de margen), con tres ya ocupados. */
const ROWS: ReadonlyArray<ReadonlyArray<{ time: string; booked?: boolean }>> = [
  [{ time: '9:00' }, { time: '9:40' }, { time: '10:20', booked: true }, { time: '11:00' }, { time: '11:40' }, { time: '12:20' }],
  [{ time: '13:00', booked: true }, { time: '13:40' }, { time: '14:20', booked: true }, { time: '15:00' }, { time: '15:40' }, { time: '16:20' }],
];

/** Paso 2: la rejilla del día con su leyenda. */
export default function SlotsMock() {
  const { t } = useSiteTranslation();
  return (
    <div className={cx('dy-vis', 'dy-out')} role="group" aria-label={t(`${P}.s2Label`)}>
      <div className={cx('dy-bars')}>
        {ROWS.map((row, r) => (
          <div key={r} className={cx('dy-bar')}>
            {row.map((slot, i) => (
              <Fragment key={slot.time}>
                <span className={cx('s', slot.booked && 'x')}>
                  {slot.time}
                  {slot.booked ? <span className={cx('srOnly')}> ({t(`${P}.booked`)})</span> : null}
                </span>
                {i < row.length - 1 ? <span className={cx('g')} aria-hidden="true" /> : null}
              </Fragment>
            ))}
          </div>
        ))}
      </div>
      <ul className={cx('dy-leg')}>
        <li>
          <i className={cx('k', 's')} aria-hidden="true" />
          {t(`${P}.leg1`)}
        </li>
        <li>
          <i className={cx('k', 'x')} aria-hidden="true" />
          {t(`${P}.leg2`)}
        </li>
        <li>
          <i className={cx('k', 'g')} aria-hidden="true" />
          {t(`${P}.leg3`)}
        </li>
      </ul>
    </div>
  );
}
