'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import Container from '../../Container';
import LogoTile, { BRAND_LOGOS } from '../../LogoTile';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import SiteLink from '../../SiteLink';
import { cx } from '../ProductSubpage/cx';
import { toolsCount } from '../productData';

const C = 'site.productBooking.calendars';
const TOOLS = ['Google Calendar', 'Calendly', 'HubSpot', 'Zoho'];

/** "Usa tu agenda actual o la de GenSmart": los dos caminos y los logos. */
export default function BookingCalendars() {
  const { t, language } = useSiteTranslation();
  return (
    <Section rhythm="l">
      <Container>
        <SectionHead title={t(`${C}.title`)} lead={t(`${C}.lead`)} />
        <div className={cx('duo')}>
          <div className={cx('stack')}>
            <h3>{t(`${C}.ownTitle`)}</h3>
            <p>{t(`${C}.ownText`)}</p>
          </div>
          <div className={cx('stack')}>
            <h3>{t(`${C}.currentTitle`)}</h3>
            <p>{t(`${C}.currentText`)}</p>
          </div>
        </div>
        <ul className={cx('tools')} aria-label={t(`${C}.toolsLabel`)}>
          {TOOLS.map((name) => {
            const logo = BRAND_LOGOS[name];
            return logo ? (
              <li key={name}>
                <LogoTile logo={logo} size="md" />
              </li>
            ) : null;
          })}
          <li>
            <SiteLink to="integrations" className={cx('more-tile')}>
              {t(`${C}.more`, { tools: toolsCount(language) })}
              <span aria-hidden="true">→</span>
            </SiteLink>
          </li>
        </ul>
      </Container>
    </Section>
  );
}
