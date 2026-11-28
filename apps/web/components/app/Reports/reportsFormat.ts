/**
 * Informes (web-47): funciones puras de formato, comparación y CSV. Sin React ni i18n (los textos los
 * arma quien llama), para poder probarlas solas.
 */

/** "8 s", "1 min 20 s", "2 h 5 min". */
export function formatSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s} s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r ? `${m} min ${r} s` : `${m} min`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Minutos de atención: "menos de 1 min" lo resuelve quien llama con 0; "11 min", "1 h 20 min". */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export type CompareKind = 'pct' | 'seconds' | 'minutes';

export interface Comparison {
  /** Hacia dónde se movió el número. */
  direction: 'up' | 'down' | 'same';
  /** true si mejoró, false si empeoró, null si quedó igual. */
  better: boolean | null;
  /** La diferencia ya formateada ("6 pts", "12 s", "3 min"). */
  amount: string;
}

/**
 * Compara con el período anterior. En porcentajes, subir es mejor; en tiempos (primera respuesta,
 * espera), bajar es mejor. Sin dato anterior (o actual) no hay comparación.
 */
export function compare(kind: CompareKind, current: number | null, previous: number | null): Comparison | null {
  if (current === null || previous === null) return null;
  const raw = current - previous;
  const rounded = Math.round(raw);
  if (rounded === 0) return { direction: 'same', better: null, amount: kind === 'pct' ? '0 pts' : kind === 'seconds' ? '0 s' : '0 min' };
  const direction = rounded > 0 ? 'up' : 'down';
  const lowerIsBetter = kind !== 'pct';
  const better = lowerIsBetter ? direction === 'down' : direction === 'up';
  const abs = Math.abs(rounded);
  const amount = kind === 'pct' ? `${abs} pts` : kind === 'seconds' ? formatSeconds(abs) : formatMinutes(abs);
  return { direction, better, amount };
}

// ── CSV ─────────────────────────────────────────────────────────────────────

export type CsvCell = string | number | null | undefined;

/** Una celda: comillas si lleva coma, comillas, salto de línea o espacios en los bordes. */
export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Filas a CSV (coma, CRLF) con BOM para que Excel lea las tildes. */
export function toCsv(rows: CsvCell[][]): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** AAAA-MM-DD en la zona dada. */
export function localDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function csvFilename(language: string, period: string, date: Date, timeZone: string): string {
  return `gensmart-${language === 'es' ? 'informes' : 'reports'}-${period}-${localDate(date, timeZone)}.csv`;
}
