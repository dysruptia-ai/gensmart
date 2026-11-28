'use client';

import React, { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Download, RotateCcw } from 'lucide-react';
import { getNavItem } from '@/lib/app-nav';
import { useTranslation } from '@/hooks/useTranslation';
import { zoneName } from '@/lib/org-time';
import PageHeader from '../PageHeader/PageHeader';
import InboxButton from '../Inbox/InboxButton';
import { getChannelMeta } from '../Inbox/channelMeta';
import PeriodSwitch from './PeriodSwitch';
import KpiCard from './KpiCard';
import ReportCard from './ReportCard';
import HourChart from './HourChart';
import BarList from './BarList';
import AgentsTable from './AgentsTable';
import { useReport } from './useReport';
import { compare, csvFilename, formatMinutes, formatSeconds, toCsv } from './reportsFormat';
import { reasonLabel, reportCsvRows } from './reportsCsv';
import { parsePeriod, type InboxReport, type ReportPeriodKey } from './types';
import styles from './ReportsScreen.module.css';

function localeOf(language: string): string {
  return language === 'es' ? 'es-CO' : 'en-US';
}

/** Informes (web-47): cómo trabajan los agentes y la Bandeja en el período elegido. */
export default function ReportsScreen() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const period = parsePeriod(searchParams.get('period'));
  const { data, loading, error, reload } = useReport(period);
  const nav = getNavItem('reports');

  const setPeriod = useCallback(
    (p: ReportPeriodKey) => {
      const q = new URLSearchParams(searchParams.toString());
      if (p === 'today') q.delete('period');
      else q.set('period', p);
      const s = q.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // El informe que se muestra es del período pedido, o el anterior mientras carga (mantiene el alto).
  const shown = data;
  const stale = loading && !!data && data.period.key !== period;

  const exportCsv = useCallback(() => {
    if (!data) return;
    const blob = new Blob([toCsv(reportCsvRows(data, t))], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = csvFilename(language, data.period.key, new Date(data.period.end), data.period.timeZone);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [data, language, t]);

  const actions = (
    <div className={styles.actions}>
      <PeriodSwitch value={period} onChange={setPeriod} />
      <InboxButton icon={Download} onClick={exportCsv} disabled={!data || loading || data.period.key !== period}>
        {t('reports.export')}
      </InboxButton>
    </div>
  );

  let body: React.ReactNode;
  if (error && !loading) {
    body = (
      <div className={styles.state} role="alert">
        <p>{t('reports.error')}</p>
        <InboxButton icon={RotateCcw} onClick={reload}>
          {t('reports.retry')}
        </InboxButton>
      </div>
    );
  } else if (!shown) {
    body = <Skeleton />;
  } else {
    body = <ReportBody r={shown} />;
  }

  return (
    <>
      <PageHeader title={t(nav.labelKey)} subtitle={t(nav.subtitleKey)} actions={actions} />
      <div className={styles.body}>
        {shown && !error && <p className={styles.range}>{rangeText(shown, t, language)}</p>}
        <div className={`${styles.content} ${stale ? styles.stale : ''}`} aria-busy={loading || undefined}>
          {body}
        </div>
      </div>
    </>
  );
}

type T = (key: string, values?: Record<string, string | number>) => string;

function rangeText(r: InboxReport, t: T, language: string): string {
  const tz = r.period.timeZone;
  const zone = zoneName(tz);
  const end = new Date(r.period.end);
  if (r.period.key === 'today') {
    const time = new Intl.DateTimeFormat(localeOf(language), { hour: 'numeric', minute: '2-digit', timeZone: tz }).format(end);
    return t('reports.range.today', { time, zone });
  }
  const f = new Intl.DateTimeFormat(localeOf(language), { day: 'numeric', month: 'short', timeZone: tz });
  return t('reports.range.days', { range: f.formatRange(new Date(r.period.start), end), zone });
}

function ReportBody({ r }: { r: InboxReport }) {
  const { t } = useTranslation();
  const k = r.kpis;
  const when = t(`reports.compare.when.${r.period.key}`);
  const periodLabel = t(`reports.period.${r.period.key}`);
  const fmtWait = (m: number) => (m < 1 ? t('reports.kpi.lessThanMinute') : formatMinutes(m));
  const pctText = (p: number) => `${Math.round(p)} %`;

  const kpis = (
    <div className={styles.kpis}>
      <KpiCard
        label={t('reports.kpi.agentResolved')}
        value={k.agentResolved.pct === null ? null : pctText(k.agentResolved.pct)}
        sub={k.agentResolved.total === 0 ? t('reports.kpi.noConversations') : t('reports.kpi.agentResolvedSub')}
        detail={k.agentResolved.total > 0 ? t('reports.kpi.agentResolvedOf', { count: k.agentResolved.count, total: k.agentResolved.total }) : null}
        comparison={compare('pct', k.agentResolved.pct, k.agentResolved.prevPct)}
        when={when}
      />
      <KpiCard
        label={t('reports.kpi.firstResponse')}
        value={k.firstResponseSeconds.median === null ? null : formatSeconds(k.firstResponseSeconds.median)}
        sub={k.firstResponseSeconds.median === null ? t('reports.kpi.noResponses') : t('reports.kpi.firstResponseSub')}
        comparison={compare('seconds', k.firstResponseSeconds.median, k.firstResponseSeconds.prev)}
        when={when}
      />
      <KpiCard
        label={t('reports.kpi.humanWait')}
        locked={!r.planAllowsPeople || !k.humanWaitMinutes}
        value={k.humanWaitMinutes?.median == null ? null : fmtWait(k.humanWaitMinutes.median)}
        sub={
          k.humanWaitMinutes?.median == null
            ? r.handoffReasons.length === 0
              ? t('reports.kpi.noHandoffs')
              : t('reports.kpi.noAttended')
            : t('reports.kpi.humanWaitSub')
        }
        detail={k.humanWaitMinutes && k.humanWaitMinutes.stillWaiting > 0 ? t('reports.kpi.stillWaiting', { count: k.humanWaitMinutes.stillWaiting }) : null}
        comparison={k.humanWaitMinutes ? compare('minutes', k.humanWaitMinutes.median, k.humanWaitMinutes.prev) : null}
        when={when}
      />
      <KpiCard
        label={t('reports.kpi.goal')}
        locked={!r.planAllowsPeople || !k.goalMet}
        value={k.goalMet?.pct == null ? null : pctText(k.goalMet.pct)}
        sub={
          k.goalMet?.pct == null
            ? r.handoffReasons.length === 0
              ? t('reports.kpi.noHandoffs')
              : t('reports.kpi.noGoalCases')
            : t('reports.kpi.goalSub', { minutes: r.responseGoalMinutes })
        }
        detail={k.goalMet && k.goalMet.total > 0 ? t('reports.kpi.goalOf', { met: k.goalMet.met, total: k.goalMet.total }) : null}
        comparison={k.goalMet ? compare('pct', k.goalMet.pct, k.goalMet.prevPct) : null}
        when={when}
      />
    </div>
  );

  if (k.agentResolved.total === 0) {
    return (
      <>
        {kpis}
        <div className={styles.state}>
          <p>{t('reports.empty')}</p>
        </div>
        <ReportCard title={t('reports.agents.title')}>
          <AgentsTable agents={r.agents} periodLabel={periodLabel} />
        </ReportCard>
      </>
    );
  }

  const channelTotal = r.byChannel.reduce((s, c) => s + c.count, 0) || 1;
  const channelMax = Math.max(1, ...r.byChannel.map((c) => c.count));
  const reasonMax = Math.max(1, ...r.handoffReasons.map((x) => x.count));

  return (
    <>
      {kpis}
      <ReportCard
        title={t('reports.hours.title')}
        lead={r.peak ? t('reports.hours.peak', { from: r.peak.from, to: r.peak.to, pct: r.peak.pct }) : null}
      >
        <HourChart byHour={r.byHour} peak={r.peak} />
      </ReportCard>
      <div className={styles.two}>
        <ReportCard title={t('reports.channels.title')}>
          <BarList
            items={r.byChannel.map((c) => {
              const meta = getChannelMeta(c.channel);
              return {
                key: c.channel,
                label: meta.label,
                color: meta.color,
                pct: (c.count / channelMax) * 100,
                value: String(c.count),
                srLabel: `${meta.label}: ${c.count} (${Math.round((c.count / channelTotal) * 100)} %)`,
              };
            })}
          />
        </ReportCard>
        <ReportCard title={t('reports.reasons.title')}>
          {r.handoffReasons.length === 0 ? (
            <p className={styles.muted}>{t('reports.reasons.empty')}</p>
          ) : (
            <BarList
              items={r.handoffReasons.map((x) => {
                const label = reasonLabel(t, x.reason);
                return {
                  key: x.reason ?? 'none',
                  label,
                  pct: (x.count / reasonMax) * 100,
                  value: `${x.pct} %`,
                  srLabel: `${label}: ${x.pct} %, ${t('reports.reasons.count', { count: x.count })}`,
                };
              })}
            />
          )}
        </ReportCard>
      </div>
      <ReportCard title={t('reports.agents.title')}>
        <AgentsTable agents={r.agents} periodLabel={periodLabel} />
      </ReportCard>
    </>
  );
}

function Skeleton() {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <div className={styles.kpis}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.skKpi} />
        ))}
      </div>
      <div className={styles.skChart} />
      <div className={styles.two}>
        <div className={styles.skCard} />
        <div className={styles.skCard} />
      </div>
      <div className={styles.skCard} />
    </div>
  );
}
