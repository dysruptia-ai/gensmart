'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import Container from '../../Container';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import ChannelIcon, { type MockChannel } from '../ProductSubpage/ChannelIcon';
import MockWindow from '../ProductSubpage/MockWindow';
import { cx } from '../ProductSubpage/cx';

const F = 'site.productCrm.funnel';
const S = 'site.productShared';

type Stage = 'lead' | 'opportunity' | 'customer';

interface FunnelCard {
  initials: string;
  name: string;
  contact: string;
  score: number;
  interestKey: string;
  agoKey: string;
  agentKey: string;
  channel: MockChannel;
  stage: Stage;
}

const CARDS: readonly FunnelCard[] = [
  { initials: 'MG', name: 'Mateo', contact: '3001234567', score: 3, interestKey: `${S}.apt3`, agoKey: `${S}.ago.m54`, agentKey: `${S}.agent.realEstate`, channel: 'telegram', stage: 'lead' },
  { initials: 'VR', name: 'Valentina', contact: 'valentina@correo.com', score: 6, interestKey: `${S}.apt2`, agoKey: `${S}.ago.m2`, agentKey: `${S}.agent.realEstate`, channel: 'instagram', stage: 'opportunity' },
  { initials: 'AP', name: 'Andrés', contact: '3109876543', score: 5, interestKey: `${F}.invoice`, agoKey: `${S}.ago.m27`, agentKey: `${S}.agent.sales`, channel: 'whatsapp', stage: 'opportunity' },
  { initials: 'LC', name: 'Laura', contact: 'laura@correo.com', score: 9, interestKey: `${S}.apt2`, agoKey: `${S}.ago.h1`, agentKey: `${S}.agent.realEstate`, channel: 'web', stage: 'customer' },
];

const STAGES: readonly Stage[] = ['lead', 'opportunity', 'customer'];

function scoreClass(score: number): string {
  return score >= 7 ? 'hi' : score >= 4 ? 'mid' : 'lo';
}

/** El embudo de tres etapas con sus tarjetas y el resumen (el promedio sale de las tarjetas). */
export default function CrmFunnel() {
  const { t, language } = useSiteTranslation();
  const count = (s: Stage) => CARDS.filter((c) => c.stage === s).length;
  const avg = CARDS.reduce((sum, c) => sum + c.score, 0) / CARDS.length;
  const stats = [
    { label: t(`${F}.leads`), value: count('lead') },
    { label: t(`${F}.opps`), value: count('opportunity') },
    { label: t(`${F}.customers`), value: count('customer') },
    { label: t(`${F}.avg`), value: new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(avg) },
  ];
  return (
    <Section surface="alt" rhythm="l">
      <Container>
        <SectionHead title={t(`${F}.title`)} lead={t(`${F}.lead`)} />
        <MockWindow label={t(`${F}.mockLabel`)} bar={t(`${F}.bar`)} variant={['crm-win', 'crm-win2']}>
          <div className={cx('crm-bar')}>
            <dl className={cx('crm-stats')}>
              {stats.map((s) => (
                <div key={s.label}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
            <span className={cx('crm-filter', 'fake')}>{t(`${F}.allAgents`)}</span>
          </div>
          <div className={cx('crm-board')}>
            {STAGES.map((stage) => (
              <div key={stage} className={cx('crm-col')}>
                <div className={cx('crm-col-h')}>
                  {t(`${S}.stage.${stage}`)}
                  <span>{count(stage)}</span>
                </div>
                {CARDS.filter((c) => c.stage === stage).map((c) => (
                  <div key={c.name} className={cx('crm-card')}>
                    <div className={cx('crm-top')}>
                      <span className={cx('crm-av')} aria-hidden="true">
                        {c.initials}
                      </span>
                      <div>
                        <b>{c.name}</b>
                        <small>{c.contact}</small>
                      </div>
                      <span className={cx('crm-sc', scoreClass(c.score))}>{c.score}</span>
                    </div>
                    <p>{t(c.interestKey)}</p>
                    <div className={cx('crm-ft')}>
                      <time>{t(c.agoKey)}</time>
                      <span>{t(c.agentKey)}</span>
                      <span className={cx('crm-ch')}>
                        <ChannelIcon channel={c.channel} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </MockWindow>
      </Container>
    </Section>
  );
}
