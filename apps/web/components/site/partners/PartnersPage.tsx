'use client';

import { FileText, LifeBuoy, LineChart, QrCode } from 'lucide-react';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import { contactVariantHref } from '@/lib/site-links';
import { isSiteLanguage } from '@/lib/site-routes';
import Container from '../Container';
import FaqSection from '../FaqSection';
import PageHero from '../PageHero';
import Section from '../Section';
import SectionHead from '../SectionHead';
import SiteButton from '../SiteButton';
import BenefitCard from './BenefitCard';
import IconList from './IconList';
import NumberedCards from './NumberedCards';
import PhotoBand from './PhotoBand';
import { P, PARTNERS_CRUMBS, TIERS_ID, WHY_ID, partnersFaqItems, programValues } from './partnersData';
import styles from './PartnersPage.module.css';

const KIT_ICONS = [FileText, QrCode, LineChart, LifeBuoy] as const;

/** Programa de socios (design/web: `partners`). */
export default function PartnersPage() {
  const { t, language } = useSiteTranslation();
  const lang = isSiteLanguage(language) ? language : 'en';
  const v = programValues(t, lang);
  const cards = (key: string, count: number) =>
    Array.from({ length: count }, (_, i) => ({
      title: t(`${key}.items.${i}.title`, v),
      text: t(`${key}.items.${i}.text`, v),
    }));

  return (
    <>
      <PageHero
        crumbs={PARTNERS_CRUMBS}
        title={{
          before: t(`${P}.hero.titleBefore`),
          accent: v.percent,
          after: t(`${P}.hero.titleAfter`, v),
        }}
        lead={t(`${P}.hero.lead`, v)}
        photo={{ src: '/site/img/partners/cobranzas-celular.webp', position: '50% 40%' }}
        actions={
          <>
            <SiteButton to="partnerSignup">{t(`${P}.hero.primary`)}</SiteButton>
            <SiteButton anchor={`#${WHY_ID}`} variant="ghost">
              {t(`${P}.hero.secondary`)}
            </SiteButton>
          </>
        }
        aside={<BenefitCard />}
      />

      <Section surface="dark" rhythm="s">
        <Container>
          <SectionHead title={t(`${P}.steps.title`)} />
          <NumberedCards items={cards(`${P}.steps`, 3)} connected />
        </Container>
      </Section>

      <Section surface="alt" rhythm="l" id={WHY_ID}>
        <Container>
          <SectionHead title={t(`${P}.why.title`)} lead={t(`${P}.why.lead`)} />
          <NumberedCards items={cards(`${P}.why`, 3)} />
        </Container>
      </Section>

      <Section surface="dark">
        <Container>
          <SectionHead title={t(`${P}.earn.title`)} lead={t(`${P}.earn.lead`)} />
          <dl className={styles.deal}>
            <div className={styles.dealItem}>
              <dt className={styles.dealValue}>{v.percent}</dt>
              <dd className={styles.dealText}>
                <b>{t(`${P}.earn.commissionTitle`)}</b>
                <span>{t(`${P}.earn.commissionText`, v)}</span>
              </dd>
            </div>
            <div className={styles.dealItem}>
              <dt className={styles.dealValue}>{v.bonusLabel}</dt>
              <dd className={styles.dealText}>
                <b>{t(`${P}.earn.bonusTitle`)}</b>
                <span>{t(`${P}.earn.bonusText`, v)}</span>
              </dd>
            </div>
          </dl>
        </Container>
      </Section>

      <Section surface="dark">
        <Container>
          <SectionHead title={t(`${P}.kit.title`)} lead={t(`${P}.kit.lead`)} />
          <IconList
            items={KIT_ICONS.map((icon, i) => ({
              icon,
              title: t(`${P}.kit.items.${i}.title`),
              text: t(`${P}.kit.items.${i}.text`),
            }))}
          />
        </Container>
      </Section>

      <PhotoBand
        id={TIERS_ID[lang]}
        photo={{ src: '/site/img/partners/profesionales-sala.webp', position: '50% 35%' }}
        pill={t(`${P}.agency.pill`)}
        title={t(`${P}.agency.title`)}
        lead={t(`${P}.agency.lead`)}
        actions={
          <>
            <SiteButton href={contactVariantHref(lang, 'partner')} variant="ghost">
              {t(`${P}.agency.primary`)}
            </SiteButton>
            <SiteButton to="partnersDirectory" variant="ghost">
              {t(`${P}.agency.secondary`)}
            </SiteButton>
          </>
        }
      />

      <FaqSection
        headingId="faq-heading"
        kicker={t(`${P}.faq.kicker`)}
        title={{ before: t(`${P}.faq.titleBefore`), accent: t(`${P}.faq.titleAccent`) }}
        help={{
          before: t(`${P}.faq.helpBefore`),
          accent: t(`${P}.faq.helpAccent`),
          after: t(`${P}.faq.helpAfter`),
        }}
        action={
          <SiteButton href={contactVariantHref(lang, 'partner')} variant="ghost">
            {t(`${P}.faq.cta`)}
          </SiteButton>
        }
        items={partnersFaqItems(t, lang)}
      />
    </>
  );
}
