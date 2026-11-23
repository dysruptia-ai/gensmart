'use client';

import { ArrowRight } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import type { SiteLinkKey } from '@/lib/site-links';
import Container from '../../Container';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import SiteLink from '../../SiteLink';
import { cx } from '../ProductSubpage/cx';

const G = 'site.productAgents.guides';

/** Guías de la base de conocimiento: `href: null` en el registro hasta migrarla. */
const GUIDES: ReadonlyArray<{ n: 1 | 2; to: SiteLinkKey }> = [
  { n: 1, to: 'docsTestAgent' },
  { n: 2, to: 'docsHandoff' },
];

export default function AgentsGuides() {
  const { t } = useTranslation();
  return (
    <Section rhythm="m">
      <Container>
        <SectionHead title={t(`${G}.title`)} />
        <ul className={cx('ag-two')}>
          {GUIDES.map((g) => (
            <li key={g.n}>
              <SiteLink to={g.to} className={cx('ag-guide')}>
                <strong>{t(`${G}.g${g.n}Kicker`)}</strong>
                <h3>{t(`${G}.g${g.n}Title`)}</h3>
                <p>{t(`${G}.g${g.n}Desc`)}</p>
                <span className={cx('ag-more')}>
                  {t(`${G}.more`)} <ArrowRight aria-hidden="true" />
                </span>
              </SiteLink>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
