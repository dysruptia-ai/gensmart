import type { HandoffReason } from '@gensmart/shared';

export type ReportPeriodKey = 'today' | '7d' | '30d';
export const REPORT_PERIODS: readonly ReportPeriodKey[] = ['today', '7d', '30d'];

export function parsePeriod(value: string | null | undefined): ReportPeriodKey {
  return (REPORT_PERIODS as readonly string[]).includes(value ?? '') ? (value as ReportPeriodKey) : 'today';
}

export type AgentReportStatus = 'active' | 'paused' | 'unpublished';

/** Respuesta de GET /api/reports/inbox (web-47). */
export interface InboxReport {
  period: { key: ReportPeriodKey; start: string; end: string; timeZone: string };
  previous: { start: string; end: string };
  planAllowsPeople: boolean;
  responseGoalMinutes: number;
  kpis: {
    agentResolved: { pct: number | null; count: number; total: number; prevPct: number | null };
    firstResponseSeconds: { median: number | null; prev: number | null };
    humanWaitMinutes: { median: number | null; prev: number | null; stillWaiting: number } | null;
    goalMet: { pct: number | null; met: number; total: number; prevPct: number | null } | null;
  };
  byHour: number[];
  peak: { from: number; to: number; pct: number } | null;
  byChannel: Array<{ channel: string; count: number }>;
  handoffReasons: Array<{ reason: HandoffReason | null; count: number; pct: number }>;
  agents: Array<{
    agentId: string;
    name: string;
    conversations: number;
    resolvedAlone: number;
    resolvedAlonePct: number | null;
    askedHelp: number;
    status: AgentReportStatus;
  }>;
}
