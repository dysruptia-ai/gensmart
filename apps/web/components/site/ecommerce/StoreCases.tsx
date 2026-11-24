'use client';

import { useTranslation } from '@/hooks/useTranslation';
import Container from '../Container';
import LogoTile, { BRAND_LOGOS } from '../LogoTile';
import Reveal from '../Reveal';
import Section from '../Section';
import SectionHead from '../SectionHead';
import SiteLink from '../SiteLink';
import { E, PLATFORMS_ID, STORE_CASES } from './ecommerceData';
import styles from './StoreCases.module.css';

interface StoreCasesProps {
  /** Activa la pestaña de la plataforma antes de bajar a `#plataformas`. */
  onPickPlatform: (i: number) => void;
}

/** "Ubica tu tienda y empieza por donde más te sirve" (design/web: `.case3`). */
export default function StoreCases({ onPickPlatform }: StoreCasesProps) {
  const { t } = useTranslation();
  const k = `${E}.cases`;
  return (
    <Section surface="alt">
      <Container>
        <SectionHead title={t(`${k}.title`)} />
        <div className={styles.cases}>
          {STORE_CASES.map((c, i) => {
            const base = `${k}.c${i + 1}`;
            const platform = c.platform;
            return (
              <Reveal key={base} className={styles.case}>
                <article className={styles.inner}>
                  <h3 className={styles.h3}>{t(`${base}.title`)}</h3>
                  <ul className={styles.logos}>
                    {c.logos.map((name) => {
                      const logo = BRAND_LOGOS[name];
                      return logo ? (
                        <li key={name}>
                          <LogoTile logo={logo} size="sm" />
                        </li>
                      ) : null;
                    })}
                  </ul>
                  <p className={styles.text}>{t(`${base}.text`)}</p>
                  <p className={styles.need}>
                    <b>{t(`${k}.needLabel`)}</b>
                    {t(`${base}.need`)}
                  </p>
                  {platform === null ? (
                    <SiteLink to="register" className={styles.link}>
                      {t(`${k}.trialLink`)} <span aria-hidden="true">→</span>
                    </SiteLink>
                  ) : (
                    <SiteLink
                      anchor={`#${PLATFORMS_ID}`}
                      className={styles.link}
                      onClick={() => onPickPlatform(platform)}
                    >
                      {t(`${k}.platLink`)} <span aria-hidden="true">→</span>
                    </SiteLink>
                  )}
                </article>
              </Reveal>
            );
          })}
        </div>
        <p className={styles.related}>
          {t(`${k}.industryBefore`)}{' '}
          <SiteLink to="industryEcommerce" className={styles.link}>
            {t(`${k}.industryLink`)} <span aria-hidden="true">→</span>
          </SiteLink>
        </p>
      </Container>
    </Section>
  );
}
