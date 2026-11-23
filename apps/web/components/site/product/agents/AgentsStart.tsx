'use client';

import { useTranslation } from '@/hooks/useTranslation';
import Container from '../../Container';
import Section from '../../Section';
import { cx } from '../ProductSubpage/cx';

const S = 'site.productAgents.start';
const H = 'site.productAgents.hero';

/** "Cómo empiezas": plantilla o desde cero, con la ficha de ejemplo. */
export default function AgentsStart() {
  const { t } = useTranslation();
  const options = [
    { key: 'sales', small: t(`${S}.template`), on: true },
    { key: 'support', small: t(`${S}.template`) },
    { key: 'bookings', small: t(`${S}.template`) },
    { key: 'scratch', small: t(`${S}.scratchDesc`), blank: true },
  ];
  const rows = [
    { label: t(`${H}.goal`), value: t(`${H}.goalValue`) },
    { label: t(`${H}.tone`), value: t(`${H}.toneValue`) },
    { label: t(`${S}.can`), value: t(`${S}.canValue`) },
    { label: t(`${S}.cannot`), value: t(`${S}.cannotValue`) },
  ];
  return (
    <Section surface="alt" rhythm="l">
      <Container>
        <div className={cx('ag-split')}>
          <div className={cx('ag-light-copy')}>
            <span className={cx('ag-k')}>{t(`${S}.kicker`)}</span>
            <h2 className={cx('h2')}>{t(`${S}.title`)}</h2>
            <p>{t(`${S}.text`)}</p>
          </div>
          <div className={cx('ag-pick')} role="group" aria-label={t(`${S}.mockLabel`)}>
            <ul className={cx('ag-pick-list')}>
              {options.map((o) => (
                <li key={o.key} className={cx(o.on && 'on', o.blank && 'blank')}>
                  <b>{t(`${S}.${o.key}`)}</b>
                  <small>{o.small}</small>
                </li>
              ))}
            </ul>
            <div className={cx('ag-pick-card')}>
              <b className={cx('ag-pick-t')}>{t(`${S}.sales`)}</b>
              <dl>
                {rows.map((r) => (
                  <div key={r.label}>
                    <dt>{r.label}</dt>
                    <dd>{r.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
