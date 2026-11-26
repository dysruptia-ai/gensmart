'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { api } from '@/lib/api';

export interface ShellAgent {
  id: string;
  name: string;
  channels: string[];
}

interface AgentsResponse {
  agents: { id: string; name: string; channels?: string[] }[];
  total: number;
}

export interface OrgAgents {
  agents: ShellAgent[];
  total: number;
}

/**
 * Agentes de la organización para el contador del riel y la paleta. Una sola llamada por
 * sesión y organización (la misma de la pantalla de agentes), sin bloquear el pintado.
 * Si falla, `null` (sin contador ni grupo "Agentes").
 */
const cache = new Map<string, Promise<OrgAgents | null>>();

function loadAgents(orgId: string): Promise<OrgAgents | null> {
  let pending = cache.get(orgId);
  if (!pending) {
    pending = api
      .get<AgentsResponse>('/api/agents?limit=100')
      .then((data) => ({
        total: data.total,
        agents: data.agents.map((a) => ({ id: a.id, name: a.name, channels: a.channels ?? [] })),
      }))
      .catch(() => null);
    cache.set(orgId, pending);
  }
  return pending;
}

export function useOrgAgents(orgId: string | undefined): OrgAgents | null {
  const [data, setData] = useState<OrgAgents | null>(null);
  useEffect(() => {
    if (!orgId) return;
    let alive = true;
    void loadAgents(orgId).then((result) => {
      if (alive) setData(result);
    });
    return () => {
      alive = false;
    };
  }, [orgId]);
  return data;
}

export interface OrgSummary {
  name: string | null;
  plan: string | null;
  trialEndsAt: string | null;
}

export interface UsageSummary {
  messages: { used: number; limit: number | null; percent: number };
}

/** Las dos llamadas que ya hacía el shell viejo: la organización (plan, prueba) y el consumo. */
export function useOrgSummary(enabled: boolean): { org: OrgSummary | null; usage: UsageSummary | null } {
  const [org, setOrg] = useState<OrgSummary | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  useEffect(() => {
    if (!enabled) return;
    api.get<UsageSummary>('/api/billing/usage').then(setUsage).catch(() => { /* no crítico */ });
    api
      .get<{ name?: string; plan?: string; trial_ends_at?: string | null }>('/api/organization')
      .then((o) => setOrg({ name: o.name ?? null, plan: o.plan ?? null, trialEndsAt: o.trial_ends_at ?? null }))
      .catch(() => { /* no crítico */ });
  }, [enabled]);
  return { org, usage };
}

function subscribeMedia(query: string) {
  return (listener: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  };
}

/** `true` desde 1080 px: riel fijo; por debajo, barra arriba y cajón. */
const DESKTOP_QUERY = '(min-width: 1080px)';
const subscribeDesktop = subscribeMedia(DESKTOP_QUERY);

export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

function detectMac(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform || nav.platform || '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}

const noopSubscribe = () => () => {};

/** "⌘K" en Mac, "Ctrl K" en el resto. */
export function useShortcutLabel(): string {
  const mac = useSyncExternalStore(noopSubscribe, detectMac, () => false);
  return mac ? '⌘K' : 'Ctrl K';
}

/** Iniciales para el avatar (máximo dos letras). */
export function initials(name: string | undefined): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '').slice(0, 2);
  return letters.toUpperCase();
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
