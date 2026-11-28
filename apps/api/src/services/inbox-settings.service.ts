/**
 * Ajustes de la Bandeja (web-45): reparto, horario y meta de respuesta. Sin fila valen los valores por
 * defecto: modo 'none' (sin asignar) y sin horario (siempre abierto).
 */
import type { BusinessHours } from '@gensmart/shared';
import { query } from '../config/database';

export type AssignmentMode = 'rotating' | 'agent' | 'none';
export const ASSIGNMENT_MODES: readonly AssignmentMode[] = ['rotating', 'agent', 'none'];

export const MEMBER_DEFAULT_CAPACITY = 8;

export interface InboxSettings {
  assignmentMode: AssignmentMode;
  keepLastPerson: boolean;
  businessHours: BusinessHours;
  outOfHoursNotice: boolean;
  responseGoalMinutes: number;
  alertEmailMinutes: number | null;
}

export const DEFAULT_INBOX_SETTINGS: InboxSettings = {
  assignmentMode: 'none',
  keepLastPerson: false,
  businessHours: null,
  outOfHoursNotice: false,
  responseGoalMinutes: 15,
  alertEmailMinutes: null,
};

export interface InboxSettingsRow {
  assignment_mode: AssignmentMode;
  keep_last_person: boolean;
  business_hours: BusinessHours;
  out_of_hours_notice: boolean;
  response_goal_minutes: number;
  alert_email_minutes: number | null;
}

export function rowToSettings(row: InboxSettingsRow | undefined): InboxSettings {
  if (!row) return { ...DEFAULT_INBOX_SETTINGS };
  return {
    assignmentMode: row.assignment_mode,
    keepLastPerson: row.keep_last_person,
    businessHours: row.business_hours ?? null,
    outOfHoursNotice: row.out_of_hours_notice,
    responseGoalMinutes: row.response_goal_minutes,
    alertEmailMinutes: row.alert_email_minutes,
  };
}

export async function getInboxSettings(organizationId: string): Promise<InboxSettings> {
  const r = await query<InboxSettingsRow>(
    `SELECT assignment_mode, keep_last_person, business_hours, out_of_hours_notice, response_goal_minutes, alert_email_minutes
     FROM inbox_settings WHERE organization_id = $1`,
    [organizationId]
  );
  return rowToSettings(r.rows[0]);
}
