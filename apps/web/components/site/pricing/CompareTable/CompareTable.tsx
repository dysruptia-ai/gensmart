'use client';

import { useState, useSyncExternalStore } from 'react';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import Container from '../../Container';
import SectionHead from '../../SectionHead';
import {
  FEATURED_PLAN,
  PLAN_IDS,
  PLAN_NAMES,
  compareGroups,
  type CompareCell,
  type CompareGroup,
} from '../pricingData';
import styles from './CompareTable.module.css';

const C = 'site.pricing.compare';
type GroupId = CompareGroup['id'];
/** Con JS, solo "Núcleo" empieza abierto (como el diseño). Sin JS se ven todos. */
const DEFAULT_OPEN: readonly GroupId[] = ['core'];

const noopSubscribe = () => () => {};
/** false en el HTML del servidor (y en la hidratación), true ya en el cliente. */
function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export default function CompareTable() {
  const { t, language } = useSiteTranslation();
  const groups = compareGroups(t, language);
  const allIds = groups.map((g) => g.id);
  // Sin JS (HTML del servidor): todo abierto y sin controles
  const enhanced = useHydrated();
  const [open, setOpen] = useState<ReadonlySet<GroupId>>(() => new Set(DEFAULT_OPEN));
  const isOpen = (id: GroupId) => !enhanced || open.has(id);
  const everyOpen = allIds.every(isOpen);

  const toggle = (id: GroupId) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderCell = (cell: CompareCell) => {
    if (cell.kind === 'text') return cell.text;
    const yes = cell.kind === 'yes';
    return (
      <>
        <span aria-hidden="true">{yes ? '✓' : '−'}</span>
        <span className={styles.srOnly}>{t(yes ? `${C}.included` : `${C}.notIncluded`)}</span>
      </>
    );
  };

  return (
    <section className={styles.section}>
      <Container>
        <SectionHead title={t(`${C}.title`)} lead={t(`${C}.lead`)} />
        {enhanced ? (
          <div className={styles.controls}>
            <button
              type="button"
              className={styles.all}
              aria-controls="plan-compare"
              onClick={() => setOpen(new Set(everyOpen ? [] : allIds))}
            >
              {t(everyOpen ? `${C}.collapseAll` : `${C}.expandAll`)}
            </button>
          </div>
        ) : null}
        <div className={styles.wrap} role="region" aria-labelledby="plan-compare-caption" tabIndex={0}>
          <table id="plan-compare" className={`${styles.table} ${enhanced ? styles.enhanced : ''}`}>
            <caption id="plan-compare-caption" className={styles.srOnly}>
              {t(`${C}.caption`)}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t(`${C}.feature`)}</th>
                {PLAN_IDS.map((id) => (
                  <th key={id} scope="col" className={id === FEATURED_PLAN ? styles.feat : undefined}>
                    {PLAN_NAMES[id]}
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map((group) => {
              const expanded = isOpen(group.id);
              const bodyId = `cmp-${group.id}`;
              return (
                <tbody key={group.id} id={bodyId} className={expanded ? styles.open : undefined}>
                  <tr className={styles.group}>
                    <th colSpan={PLAN_IDS.length + 1} scope="rowgroup">
                      <button
                        type="button"
                        className={styles.groupBtn}
                        aria-expanded={expanded}
                        aria-controls={bodyId}
                        onClick={() => toggle(group.id)}
                        disabled={!enhanced}
                      >
                        <span>{group.label}</span>
                        {enhanced ? (
                          <>
                            <span className={styles.count}>
                              {t(`${C}.count`, { n: group.rows.length })}
                            </span>
                            <i className={styles.chev} aria-hidden="true" />
                          </>
                        ) : null}
                      </button>
                    </th>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.id} className={styles.row}>
                      <th scope="row">{row.label}</th>
                      {row.cells.map((cell, i) => {
                        const plan = PLAN_IDS[i];
                        const classes = [
                          plan === FEATURED_PLAN ? styles.feat : '',
                          cell.kind === 'yes' ? styles.yes : cell.kind === 'no' ? styles.no : '',
                        ]
                          .filter(Boolean)
                          .join(' ');
                        return (
                          <td key={plan} className={classes || undefined}>
                            {renderCell(cell)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>
      </Container>
    </section>
  );
}
