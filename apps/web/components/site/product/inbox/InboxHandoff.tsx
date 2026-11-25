'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import Container from '../../Container';
import Section from '../../Section';
import { cx } from '../ProductSubpage/cx';
import HandoffCard from './HandoffCard';

const P = 'site.productInbox.handoff';

/** "Pasa a una persona": la tarjeta del traspaso y los tres puntos. */
export default function InboxHandoff() {
  const { t } = useSiteTranslation();
  return (
    <Section rhythm="l">
      <Container className={cx('split')}>
        <HandoffCard />
        <div className={cx('stack')}>
          <h2>{t(`${P}.title`)}</h2>
          <p className={cx('stackLead')}>{t(`${P}.lead`)}</p>
          <ul className={cx('plain')}>
            {[1, 2, 3].map((i) => (
              <li key={i}>{t(`${P}.p${i}`)}</li>
            ))}
          </ul>
        </div>
      </Container>
    </Section>
  );
}
