'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import Container from '../../Container';
import Section from '../../Section';
import { cx } from '../ProductSubpage/cx';
import ContactRecordMock from './ContactRecordMock';

const R = 'site.productCrm.record';

/** "Todo lo que sabes de la persona…": lo que trae la ficha y su maqueta. */
export default function CrmRecord() {
  const { t } = useSiteTranslation();
  return (
    <Section rhythm="l" className={cx('cx')}>
      <Container className={cx('cx-fic-wrap')}>
        <div className={cx('stack')}>
          <h2>{t(`${R}.title`)}</h2>
          <p className={cx('stackLead')}>{t(`${R}.lead`)}</p>
          <ul className={cx('cx-list')}>
            {[1, 2, 3, 4, 5].map((i) => (
              <li key={i}>
                <b>{t(`${R}.i${i}`)}</b>
                <span>{t(`${R}.i${i}Desc`)}</span>
              </li>
            ))}
          </ul>
        </div>
        <ContactRecordMock />
      </Container>
    </Section>
  );
}
