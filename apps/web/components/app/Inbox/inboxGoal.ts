/**
 * La meta de respuesta en la lista y en el hilo (web-45). Pura: la espera se mide en minutos de
 * atención (businessMinutesBetween), no en minutos reales.
 */
import { businessMinutesBetween, isOpenAt, nextOpening, type BusinessHours } from '@gensmart/shared';

export interface GoalConfig {
  goalMinutes: number;
  hours: BusinessHours;
  timeZone: string;
}

export type GoalState =
  | { kind: 'none' }
  | { kind: 'closed'; nextOpening: Date | null }
  | { kind: 'ok' | 'over'; waitMinutes: number; percent: number };

/** Los minutos de atención que lleva esperando. */
export function waitBusinessMinutes(since: string, cfg: GoalConfig, now: number): number {
  return Math.max(0, Math.floor(businessMinutesBetween(cfg.hours, cfg.timeZone, new Date(since), new Date(now))));
}

/** La barra de "Necesitan a alguien": nada si no espera nadie; la nota si está cerrado. */
export function goalBarState(oldestWaitingSince: string | null | undefined, cfg: GoalConfig, now: number): GoalState {
  if (!oldestWaitingSince) return { kind: 'none' };
  const at = new Date(now);
  if (!isOpenAt(cfg.hours, cfg.timeZone, at)) return { kind: 'closed', nextOpening: nextOpening(cfg.hours, cfg.timeZone, at) };
  const waitMinutes = waitBusinessMinutes(oldestWaitingSince, cfg, now);
  const percent = Math.min(100, Math.round((waitMinutes / Math.max(1, cfg.goalMinutes)) * 100));
  return { kind: waitMinutes > cfg.goalMinutes ? 'over' : 'ok', waitMinutes, percent };
}

/** La fila o el hilo pasaron la meta (fuera de horario nunca, porque no corre). */
export function isOverGoal(waitingSince: string | null | undefined, cfg: GoalConfig | null, now: number): boolean {
  if (!waitingSince || !cfg) return false;
  if (!isOpenAt(cfg.hours, cfg.timeZone, new Date(now))) return false;
  return waitBusinessMinutes(waitingSince, cfg, now) > cfg.goalMinutes;
}

/** "31 min", "1 h 5 min" (el fmtWait del diseño). */
export function formatWaitMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const rest = m % 60;
  return rest ? `${Math.floor(m / 60)} h ${rest} min` : `${Math.floor(m / 60)} h`;
}
