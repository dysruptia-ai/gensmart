'use client';

import { ArrowRight } from 'lucide-react';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import { isSiteLanguage } from '@/lib/site-routes';
import PageHero from '../PageHero';
import SiteButton from '../SiteButton';
import SiteLink from '../SiteLink';
import { INDUSTRIES } from '../industries/industriesData';
import PendingLink from './PendingLink';
import ResourceBlock from './ResourceBlock';
import {
  ACADEMY_COURSES,
  DOC_GROUPS,
  DOC_GUIDES,
  RESOURCE_BLOG_POSTS,
  academyHref,
  blogPostHref,
  docHref,
} from './resourceLinks';
import { R, RESOURCES_CRUMBS, SECTION_IDS } from './resourcesData';
import styles from './ResourcesPage.module.css';

const ASK_STEPS = 3;

/** Centro de recursos (design/web: `recursos`). */
export default function ResourcesPage() {
  const { t, language } = useSiteTranslation();
  const lang = isSiteLanguage(language) ? language : 'en';
  const go = <ArrowRight className={styles.go} size={20} aria-hidden="true" />;

  return (
    <>
      <PageHero crumbs={RESOURCES_CRUMBS} title={{ before: t(`${R}.hero.title`) }} lead={t(`${R}.hero.lead`)} />

      <ResourceBlock
        first
        id={SECTION_IDS.docs[lang]}
        name={t(`${R}.docs.name`)}
        when={t(`${R}.docs.when`)}
        lead={t(`${R}.docs.lead`)}
        action={<SiteButton to="docs">{t(`${R}.docs.cta`)}</SiteButton>}
      >
        <div className={styles.cols}>
          {DOC_GROUPS.map((group) => (
            <div key={group} className={styles.col}>
              <h3 className={styles.colTitle}>{t(`${R}.docs.groups.${group}`)}</h3>
              <ul className={styles.list}>
                {DOC_GUIDES.filter((d) => d.group === group).map((d) => (
                  <li key={d.slug.es}>
                    <PendingLink className={styles.colLink} href={docHref(d.slug[lang], lang)}>
                      {d.title[lang]}
                    </PendingLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </ResourceBlock>

      <ResourceBlock
        flip
        surface="alt"
        id={SECTION_IDS.academy[lang]}
        name={t(`${R}.academy.name`)}
        when={t(`${R}.academy.when`)}
        lead={t(`${R}.academy.lead`)}
        action={<SiteButton to="academy">{t(`${R}.academy.cta`)}</SiteButton>}
      >
        <ul className={`${styles.list} ${styles.routes}`}>
          {ACADEMY_COURSES.map((c) => (
            <li key={c.slug.es}>
              <PendingLink className={styles.row} href={academyHref(c.slug[lang], lang)}>
                <span>
                  <b className={styles.rowTitle}>{c.title[lang]}</b>
                  <small className={styles.rowText}>{c.goal[lang]}</small>
                </span>
                {go}
              </PendingLink>
            </li>
          ))}
        </ul>
      </ResourceBlock>

      <ResourceBlock
        id={SECTION_IDS.blog[lang]}
        name={t(`${R}.blog.name`)}
        when={t(`${R}.blog.when`)}
        lead={t(`${R}.blog.lead`)}
        action={<SiteButton to="blog">{t(`${R}.blog.cta`)}</SiteButton>}
      >
        <ul className={`${styles.list} ${styles.posts}`}>
          {RESOURCE_BLOG_POSTS.map((p) => (
            <li key={p.slug.es}>
              <PendingLink className={`${styles.row} ${styles.post}`} href={blogPostHref(p.slug[lang], lang)}>
                <span>
                  <small className={styles.postCat}>{p.category[lang]}</small>
                  <b className={styles.rowTitle}>{p.title[lang]}</b>
                </span>
                {go}
              </PendingLink>
            </li>
          ))}
        </ul>
      </ResourceBlock>

      <ResourceBlock
        flip
        surface="alt"
        id={SECTION_IDS.cases[lang]}
        name={t(`${R}.cases.name`)}
        when={t(`${R}.cases.when`)}
        lead={t(`${R}.cases.lead`)}
        action={<SiteButton to="cases">{t(`${R}.cases.cta`)}</SiteButton>}
      >
        <ul className={`${styles.list} ${styles.chips}`}>
          {INDUSTRIES.map((industry) => (
            <li key={industry.id}>
              <SiteLink className={styles.chip} to={industry.id}>
                {t(`${industry.base}.name`)}
              </SiteLink>
            </li>
          ))}
        </ul>
      </ResourceBlock>

      <ResourceBlock
        id={SECTION_IDS.community[lang]}
        name={t(`${R}.community.name`)}
        when={t(`${R}.community.when`)}
        lead={t(`${R}.community.lead`)}
        action={<SiteButton to="community">{t(`${R}.community.cta`)}</SiteButton>}
      >
        <div role="group" aria-label={t(`${R}.community.askLabel`)}>
          <p className={styles.askTitle}>{t(`${R}.community.askTitle`)}</p>
          <div className={styles.bubbles}>
            {Array.from({ length: ASK_STEPS }, (_, i) => (
              <p key={i} className={styles.bubble}>
                <b>{t(`${R}.community.ask.${i}.label`)}</b>
                <span>{t(`${R}.community.ask.${i}.text`)}</span>
              </p>
            ))}
          </div>
        </div>
      </ResourceBlock>
    </>
  );
}
