'use client';

import { useId, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { contactVariantHref } from '@/lib/site-links';
import { isSiteLanguage } from '@/lib/site-routes';
import SiteButton from '../SiteButton';
import {
  COUNTRIES,
  D,
  DIRECTORY_PARTNERS,
  PARTNER_LANGUAGES,
  PARTNER_SERVICES,
  servesCountry,
  type DirectoryPartner,
} from './partnersData';
import styles from './DirectorySearch.module.css';

interface Filters {
  q: string;
  service: string;
  country: string;
  language: string;
}

const EMPTY: Filters = { q: '', service: '', country: '', language: '' };

function matches(p: DirectoryPartner, f: Filters): boolean {
  const q = f.q.trim().toLowerCase();
  if (q && !p.name.toLowerCase().includes(q)) return false;
  if (f.service && !(p.services as readonly string[]).includes(f.service)) return false;
  if (f.language && !(p.languages as readonly string[]).includes(f.language)) return false;
  if (f.country && !servesCountry(p, f.country)) return false;
  return true;
}

/**
 * Buscador del directorio (design/web: `.dir-bar`, `.dir-lista`). Las fichas llegan
 * completas en el HTML del servidor; el filtro solo las oculta en el cliente.
 */
export default function DirectorySearch() {
  const { t, language } = useTranslation();
  const lang = isSiteLanguage(language) ? language : 'en';
  const id = useId();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const S = `${D}.search`;
  const C = `${D}.card`;

  const visible = DIRECTORY_PARTNERS.map((p) => matches(p, filters));
  const count = visible.filter(Boolean).length;
  const set = (key: keyof Filters) => (value: string) => setFilters((prev) => ({ ...prev, [key]: value }));
  const fid = (name: keyof Filters) => `${id}-${name}`;
  const recommend = contactVariantHref(lang, 'recomendacion');

  return (
    <>
      <h2 className={styles.srOnly}>{t(`${S}.title`)}</h2>
      <form
        className={styles.bar}
        role="search"
        aria-label={t(`${S}.label`)}
        onSubmit={(e: FormEvent) => e.preventDefault()}
        onReset={() => setFilters(EMPTY)}
      >
        <div className={`${styles.field} ${styles.fieldQ}`}>
          <label htmlFor={fid('q')}>{t(`${S}.q`)}</label>
          <input
            id={fid('q')}
            name="q"
            type="search"
            autoComplete="off"
            placeholder={t(`${S}.qPlaceholder`)}
            value={filters.q}
            onChange={(e) => set('q')(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={fid('service')}>{t(`${S}.service`)}</label>
          <select id={fid('service')} name="service" value={filters.service} onChange={(e) => set('service')(e.target.value)}>
            <option value="">{t(`${S}.all`)}</option>
            {PARTNER_SERVICES.map((s) => (
              <option key={s} value={s}>
                {t(`${S}.services.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div className={`${styles.field} ${styles.fieldCountry}`}>
          <label htmlFor={fid('country')}>{t(`${S}.country`)}</label>
          <select id={fid('country')} name="country" value={filters.country} onChange={(e) => set('country')(e.target.value)}>
            <option value="">{t(`${S}.allCountries`)}</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name[lang]}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={fid('language')}>{t(`${S}.language`)}</label>
          <select id={fid('language')} name="language" value={filters.language} onChange={(e) => set('language')(e.target.value)}>
            <option value="">{t(`${S}.all`)}</option>
            {PARTNER_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {t(`${S}.languages.${l}`)}
              </option>
            ))}
          </select>
        </div>
        <button className={styles.reset} type="reset">
          {t(`${S}.reset`)}
        </button>
      </form>

      <div className={styles.match}>
        <p>
          <b>{t(`${S}.matchStrong`)}</b> {t(`${S}.matchText`)}
        </p>
        <SiteButton href={recommend} variant="ghost" size="sm">
          {t(`${S}.matchCta`)}
        </SiteButton>
      </div>

      <p className={styles.count} aria-live="polite">
        {count === 1 ? t(`${S}.countOne`) : t(`${S}.countOther`, { count })}
      </p>

      <ol className={styles.list}>
        {DIRECTORY_PARTNERS.map((p, i) => {
          const K = `${D}.partners.${p.key}`;
          const logo = p.logo[lang];
          return (
            <li key={p.key} className={styles.row} hidden={!visible[i]}>
              <span className={styles.logo}>
                <Image src={logo.src} alt={p.name} width={logo.width} height={logo.height} sizes="156px" />
              </span>
              <div className={styles.main}>
                <h3 className={styles.name}>{p.name}</h3>
                <p className={styles.meta}>{t(`${K}.tag`)}</p>
                <p className={styles.desc}>{t(`${K}.description`)}</p>
                <dl className={styles.facts}>
                  <div>
                    <dt>{t(`${C}.services`)}</dt>
                    <dd>{p.services.map((s) => t(`${S}.services.${s}`)).join(' · ')}</dd>
                  </div>
                  <div>
                    <dt>{t(`${C}.where`)}</dt>
                    <dd>{t(`${K}.where`)}</dd>
                  </div>
                  <div>
                    <dt>{t(`${C}.languages`)}</dt>
                    <dd>{t(`${K}.languages`)}</dd>
                  </div>
                </dl>
              </div>
              <div className={styles.side}>
                <SiteButton href={contactVariantHref(lang, 'recomendacion', p.name)} size="sm">
                  {t(`${C}.contact`)}
                  <span className={styles.srOnly}> {t(`${C}.contactSr`, { name: p.name })}</span>
                </SiteButton>
                <a className={styles.web} href={p.url} target="_blank" rel="noopener">
                  {t(`${C}.site`)}
                  <ExternalLink size={14} aria-hidden="true" />
                  <span className={styles.srOnly}> {t(`${C}.siteSr`, { name: p.name })}</span>
                </a>
              </div>
            </li>
          );
        })}
      </ol>

      <div className={styles.empty} hidden={count !== 0}>
        <h3>{t(`${S}.emptyTitle`)}</h3>
        <p>{t(`${S}.emptyText`)}</p>
        <SiteButton href={recommend}>{t(`${S}.emptyCta`)}</SiteButton>
      </div>
    </>
  );
}
