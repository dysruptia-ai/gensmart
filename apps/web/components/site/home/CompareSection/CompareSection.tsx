'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import Container from '../../Container';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import styles from './CompareSection.module.css';

const ROW_IDS = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'] as const;

export default function CompareSection() {
  const { t } = useSiteTranslation();
  const k = (id: string, field: string) => t(`site.home.compare.rows.${id}.${field}`);

  return (
    <Section surface="alt" className={styles.compare}>
      <Container>
        <SectionHead title={t('site.home.compare.title')} lead={t('site.home.compare.lead')} />

        {/* Tabla: se oculta con CSS en ≤ 640px (display:none también la saca del árbol de accesibilidad) */}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            {/* El diseño oculta el caption a la vista (.tbl.cmp caption); queda para lectores de pantalla */}
            <caption className={styles.srOnly}>{t('site.home.compare.caption')}</caption>
            <colgroup>
              <col className={styles.col1} />
              <col className={styles.col2} />
              <col className={styles.col3} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">{t('site.home.compare.aspect')}</th>
                <th scope="col">{t('site.home.compare.old')}</th>
                <th scope="col" className={styles.thNew}>
                  {t('site.home.compare.new')}
                </th>
              </tr>
            </thead>
            <tbody>
              {ROW_IDS.map((id) => (
                <tr key={id}>
                  <th scope="row" className={styles.rowHead}>
                    {k(id, 'aspect')}
                  </th>
                  <td className={styles.old}>{k(id, 'old')}</td>
                  <td className={styles.new}>{k(id, 'new')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tarjetas: solo visibles en ≤ 640px */}
        <ul className={styles.cards}>
          {ROW_IDS.map((id) => (
            <li key={id} className={styles.card}>
              <p className={styles.cardAspect}>
                <span className={styles.cardLabel}>{t('site.home.compare.aspect')}</span>
                <span className={styles.cardAspectText}>{k(id, 'aspect')}</span>
              </p>
              <div className={styles.cardOld}>
                <span className={styles.cardLabel}>{t('site.home.compare.old')}</span>
                <span className={styles.cardOldText}>{k(id, 'old')}</span>
              </div>
              <div className={styles.cardNew}>
                <span className={`${styles.cardLabel} ${styles.cardLabelNew}`}>
                  {t('site.home.compare.new')}
                </span>
                <span>{k(id, 'new')}</span>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
