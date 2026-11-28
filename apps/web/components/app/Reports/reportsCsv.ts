/**
 * Informes (web-47): el CSV se arma en el navegador con la misma respuesta de la API. Formato largo,
 * una fila por dato: seccion, etiqueta, valor, valor_anterior. En Solo no van Espera ni Meta.
 */
import type { HandoffReason } from '@gensmart/shared';
import { getChannelMeta } from '../Inbox/channelMeta';
import type { CsvCell } from './reportsFormat';
import type { InboxReport } from './types';

type T = (key: string, values?: Record<string, string | number>) => string;

export function reasonLabel(t: T, reason: HandoffReason | null): string {
  if (reason === null) return t('reports.reasons.none');
  if (reason === 'other') return t('reports.reasons.other');
  const s = t(`inbox.handoffCause.${reason}`);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function reportCsvRows(r: InboxReport, t: T): CsvCell[][] {
  const S = (k: string) => t(`reports.csv.sections.${k}`);
  const k = r.kpis;
  const rows: CsvCell[][] = [
    [t('reports.csv.header.section'), t('reports.csv.header.label'), t('reports.csv.header.value'), t('reports.csv.header.previous')],
    [S('summary'), t('reports.csv.conversations'), k.agentResolved.total, null],
    [S('summary'), t('reports.csv.agentResolvedCount'), k.agentResolved.count, null],
    [S('summary'), t('reports.csv.agentResolvedPct'), k.agentResolved.pct, k.agentResolved.prevPct],
    [S('summary'), t('reports.csv.firstResponse'), k.firstResponseSeconds.median, k.firstResponseSeconds.prev],
  ];
  if (k.humanWaitMinutes) {
    rows.push([S('summary'), t('reports.csv.humanWait'), k.humanWaitMinutes.median, k.humanWaitMinutes.prev]);
    rows.push([S('summary'), t('reports.csv.stillWaiting'), k.humanWaitMinutes.stillWaiting, null]);
  }
  if (k.goalMet) {
    rows.push([S('summary'), t('reports.csv.goal'), k.goalMet.pct, k.goalMet.prevPct]);
    rows.push([S('summary'), t('reports.csv.goalMinutes'), r.responseGoalMinutes, null]);
  }
  r.byHour.forEach((v, h) => rows.push([S('hour'), h, v, null]));
  for (const c of r.byChannel) rows.push([S('channel'), getChannelMeta(c.channel).label, c.count, null]);
  for (const x of r.handoffReasons) rows.push([S('reason'), reasonLabel(t, x.reason), x.count, null]);
  for (const a of r.agents) {
    const name = a.name;
    rows.push([S('agent'), t('reports.csv.agentConversations', { name }), a.conversations, null]);
    rows.push([S('agent'), t('reports.csv.agentResolved', { name }), a.resolvedAlone, null]);
    rows.push([S('agent'), t('reports.csv.agentResolvedPct', { name }), a.resolvedAlonePct, null]);
    rows.push([S('agent'), t('reports.csv.agentAskedHelp', { name }), a.askedHelp, null]);
    rows.push([S('agent'), t('reports.csv.agentStatus', { name }), t(`reports.agents.${a.status}`), null]);
  }
  return rows;
}
