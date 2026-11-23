'use client';

import { useTranslation } from '@/hooks/useTranslation';
import SubpageHero from '../ProductSubpage/SubpageHero';
import AgentBuilderMock from './AgentBuilderMock';

const H = 'site.productAgents.hero';

export default function AgentsHero() {
  const { t } = useTranslation();
  return (
    <SubpageHero
      id="productAgents"
      title={{ before: t(`${H}.titleBefore`), accent: t(`${H}.titleAccent`) }}
      lead={t(`${H}.lead`)}
      primary={t(`${H}.primary`)}
      secondary={{ to: 'productInbox', label: t(`${H}.secondary`) }}
      mock={<AgentBuilderMock />}
    />
  );
}
