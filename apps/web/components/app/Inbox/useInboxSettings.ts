'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BusinessHours } from '@gensmart/shared';
import { api } from '@/lib/api';
import { useWebSocket, type WebSocketEvents } from '@/hooks/useWebSocket';
import type { GoalConfig } from './inboxGoal';

export type AssignmentMode = 'rotating' | 'agent' | 'none';

export interface InboxSettingsValues {
  assignmentMode: AssignmentMode;
  keepLastPerson: boolean;
  businessHours: BusinessHours;
  outOfHoursNotice: boolean;
  responseGoalMinutes: number;
  alertEmailMinutes: number | null;
}

export interface InboxTeamMember {
  userId: string;
  name: string | null;
  role: string;
  online: boolean;
  openCount: number;
  capacity: number;
  receives: boolean;
}

export interface AgentAssignee {
  agentId: string;
  agentName: string;
  userId: string | null;
}

export interface InboxSettingsResponse {
  settings: InboxSettingsValues;
  timezone: string | null;
  plan: string;
  canTakeOver: boolean;
  team: InboxTeamMember[];
  agentAssignees: AgentAssignee[];
}

/**
 * Ajustes de la bandeja (web-45) para la pantalla de ajustes y para la meta de la lista. Se recarga con
 * `inbox-settings:changed` y la presencia se actualiza sola con `inbox-presence:changed`.
 */
export function useInboxSettings(enabled = true) {
  const [data, setData] = useState<InboxSettingsResponse | null>(null);
  const [error, setError] = useState(false);
  const { on, off } = useWebSocket();

  const reload = useCallback(() => {
    api
      .get<InboxSettingsResponse>('/api/inbox-settings')
      .then((d) => {
        setData(d);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);

  useEffect(() => {
    if (!enabled) return;
    const onPresence: WebSocketEvents['inbox-presence:changed'] = ({ userId, online }) =>
      setData((d) => (d ? { ...d, team: d.team.map((m) => (m.userId === userId ? { ...m, online } : m)) } : d));
    const onChanged: WebSocketEvents['inbox-settings:changed'] = () => reload();
    on('inbox-presence:changed', onPresence);
    on('inbox-settings:changed', onChanged);
    return () => {
      off('inbox-presence:changed', onPresence);
      off('inbox-settings:changed', onChanged);
    };
  }, [enabled, on, off, reload]);

  return { data, setData, error, reload };
}

/** La meta para la lista y el hilo; null mientras carga. */
export function useGoalConfig(data: InboxSettingsResponse | null, fallbackTimeZone?: string): GoalConfig | null {
  return useMemo(() => {
    if (!data) return null;
    const tz = data.timezone ?? fallbackTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    return { goalMinutes: data.settings.responseGoalMinutes, hours: data.settings.businessHours, timeZone: tz };
  }, [data, fallbackTimeZone]);
}
