'use client';

import { Database, FlaskConical, MessagesSquare, Plug, SlidersHorizontal, TrendingUp } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { contactVariantHref } from '@/lib/site-links';
import { isSiteLanguage } from '@/lib/site-routes';
import Container from '../Container';
import PageHero from '../PageHero';
import Section from '../Section';
import SectionHead from '../SectionHead';
import SiteButton from '../SiteButton';
import { SITE_TRIAL_DAYS } from '../siteTrial';
import DirectorySearch from './DirectorySearch';
import IconList from './IconList';
import NumberedCards from './NumberedCards';
import PhotoBand from './PhotoBand';
import { D, DIRECTORY_CRUMBS, HOW_ID, SEARCH_ID } from './partnersData';

const ASK_ICONS = [MessagesSquare, Database, SlidersHorizontal, Plug, FlaskConical, TrendingUp] as const;

/** Directorio de partners (design/web: `directorio`). */
export default function PartnerDirectoryPage() {
  const { t, language } = useTranslation();
  const lang = isSiteLanguage(language) ? language : 'en';
  const recommend = contactVariantHref(lang, 'recomendacion');

  return (
    <>
      <PageHero
        crumbs={DIRECTORY_CRUMBS}
        title={{
          before: t(`${D}.hero.titleBefore`),
          accent: t(`${D}.hero.titleAccent`),
          after: t(`${D}.hero.titleAfter`),
        }}
        lead={t(`${D}.hero.lead`)}
        photo={{ src: '/site/img/partners/directorio-equipo.webp', position: '50% 40%' }}
        actions={
          <>
            <SiteButton href={recommend}>{t(`${D}.hero.primary`)}</SiteButton>
            <SiteButton anchor={`#${SEARCH_ID}`} variant="ghost">
              {t(`${D}.hero.secondary`)}
            </SiteButton>
          </>
        }
      />

      <Section surface="alt" id={HOW_ID}>
        <Container>
          <SectionHead title={t(`${D}.how.title`)} />
          <NumberedCards
            items={Array.from({ length: 3 }, (_, i) => ({
              title: t(`${D}.how.items.${i}.title`),
              text: t(`${D}.how.items.${i}.text`, { days: SITE_TRIAL_DAYS }),
            }))}
          />
        </Container>
      </Section>

      <Section surface="dark" rhythm="l" id={SEARCH_ID}>
        <Container>
          <DirectorySearch />
        </Container>
      </Section>

      <Section surface="alt">
        <Container>
          <SectionHead title={t(`${D}.ask.title`)} lead={t(`${D}.ask.lead`)} />
          <IconList
            items={ASK_ICONS.map((icon, i) => ({
              icon,
              title: t(`${D}.ask.items.${i}.title`),
              text: t(`${D}.ask.items.${i}.text`),
            }))}
          />
        </Container>
      </Section>

      <PhotoBand
        id="entrar"
        photo={{ src: '/site/img/partners/profesionales-sala.webp', position: '50% 35%' }}
        pill={t(`${D}.band.pill`)}
        title={t(`${D}.band.title`)}
        lead={t(`${D}.band.lead`)}
        actions={
          <>
            <SiteButton href={contactVariantHref(lang, 'directorio')}>{t(`${D}.band.primary`)}</SiteButton>
            <SiteButton to="partners" variant="ghost">
              {t(`${D}.band.secondary`)}
            </SiteButton>
          </>
        }
      />
    </>
  );
}
