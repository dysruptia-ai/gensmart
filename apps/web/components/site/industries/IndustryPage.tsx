'use client';

import { useTranslation } from '@/hooks/useTranslation';
import SiteButton from '../SiteButton';
import SiteLink from '../SiteLink';
import SolutionHero from '../solutions/SolutionHero';
import SolutionMethod from '../solutions/SolutionMethod';
import SolutionInbox from '../solutions/SolutionInbox';
import SolutionIntegrations from '../solutions/SolutionIntegrations';
import SolutionChannels from '../solutions/SolutionChannels';
import SolutionFaq from '../solutions/SolutionFaq';
import SolutionMore from '../solutions/SolutionMore';
import { nextThree } from '../solutions/solutionsData';
import { INDUSTRIES, INDUSTRY_COMMON, type IndustryData } from './industriesData';
import styles from './IndustryPage.module.css';

interface IndustryPageProps {
  industry: IndustryData;
}

/** Secciones de una página de industria (design/web: `industryPage`, rama con `method`). */
export default function IndustryPage({ industry }: IndustryPageProps) {
  const { t } = useTranslation();
  const c = INDUSTRY_COMMON;
  return (
    <>
      <SolutionHero page={industry} />
      <SolutionMethod page={industry}>
        {industry.id === 'industryEcommerce' ? (
          // La landing para tiendas online enlaza de vuelta aquí (los dos sentidos)
          <p className={styles.related}>
            {t(`${c}.ecommerceBefore`)}{' '}
            <SiteLink to="ecommerce" className={styles.link}>
              {t(`${c}.ecommerceLink`)} <span aria-hidden="true">→</span>
            </SiteLink>
          </p>
        ) : null}
      </SolutionMethod>
      <SolutionInbox page={industry} />
      <SolutionIntegrations page={industry} />
      <SolutionChannels common={c} />
      <SolutionFaq page={industry} />
      <SolutionMore
        title={t(`${c}.moreTitle`)}
        pages={nextThree(INDUSTRIES, industry.id)}
        footer={
          <SiteButton to="solutions" variant="ghost">
            {t(`${c}.moreAll`)}
          </SiteButton>
        }
      />
    </>
  );
}
