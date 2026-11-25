'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import { cx } from '../ProductSubpage/cx';

const R = 'site.productCrm.record';
const S = 'site.productShared';

/** Ficha de Valentina (design: `.cx-fic`). Los botones son texto: ilustración, no controles. */
export default function ContactRecordMock() {
  const { t } = useSiteTranslation();
  return (
    <div className={cx('cx-fic')} role="group" aria-label={t(`${R}.mockLabel`)}>
      <div className={cx('cx-fic-h')}>
        <span className={cx('crm-av')} aria-hidden="true">
          VR
        </span>
        <div>
          <b>Valentina</b>
          <small>valentina@correo.com</small>
        </div>
        <span className={cx('cx-mv', 'fake')}>{t(`${R}.move`)}</span>
      </div>
      <div className={cx('cx-fic-b')}>
        <div className={cx('cx-fic-c')}>
          <small>{t(`${S}.fields.stage`)}</small>
          <span className={cx('st', 'a')}>{t(`${S}.stage.opportunity`)}</span>
        </div>
        <div className={cx('cx-fic-c')}>
          <small>{t(`${S}.fields.score`)}</small>
          <b>6 / 10</b>
        </div>
      </div>
      <div className={cx('cx-tl')}>
        <small>{t(`${R}.timeline`)}</small>
        <ol>
          {[1, 2].map((i) => (
            <li key={i}>
              <i aria-hidden="true" />
              {t(`${R}.tl${i}`)}
            </li>
          ))}
        </ol>
      </div>
      <div className={cx('cx-tl')}>
        <small>{t(`${R}.notes`)}</small>
        <p className={cx('cx-nt')}>{t(`${R}.note`)}</p>
        <div className={cx('cx-chips')}>
          <span>{t(`${R}.tag1`)}</span>
          <span>{t(`${R}.tag2`)}</span>
        </div>
      </div>
      <span className={cx('cx-re', 'fake')}>{t(`${R}.reanalyze`)}</span>
    </div>
  );
}
