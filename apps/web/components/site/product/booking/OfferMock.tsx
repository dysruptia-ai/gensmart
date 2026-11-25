'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import { cx } from '../ProductSubpage/cx';

const P = 'site.productBooking.steps';
const OFFER = ['10:20', '11:00', '11:40'];

/** Paso 3: el recorrido hasta proponer horarios y los horarios propuestos. */
export default function OfferMock() {
  const { t } = useSiteTranslation();
  return (
    <div className={cx('dy-vis')} role="group" aria-label={t(`${P}.s3Label`)}>
      <ol className={cx('dy-flow')}>
        {[1, 2, 3, 4].map((i) => (
          <li key={i} className={cx('fn', i === 4 && 'on')}>
            {t(`${P}.f${i}`)}
          </li>
        ))}
      </ol>
      <ul className={cx('dy-offer')}>
        {OFFER.map((time) => (
          <li key={time}>{time}</li>
        ))}
      </ul>
    </div>
  );
}
