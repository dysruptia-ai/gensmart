import {
  BookOpen,
  Bot,
  Calendar,
  CreditCard,
  Filter,
  GraduationCap,
  Home,
  Inbox,
  LineChart,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';

/**
 * Registro único del menú del dashboard (web-40). Lo usan el riel, el riel encogido de la
 * Bandeja, el cajón en móvil, la paleta Ctrl/Cmd+K y el título de la pestaña.
 */
export type AppNavGroupId = 'operations' | 'agents' | 'business';

export type AppNavItemId =
  | 'today'
  | 'inbox'
  | 'contacts'
  | 'pipeline'
  | 'calendar'
  | 'agents'
  | 'training'
  | 'knowledge'
  | 'reports'
  | 'billing'
  | 'settings';

export interface AppNavItem {
  id: AppNavItemId;
  /** Clave de i18n del nombre (i18n/app). */
  labelKey: string;
  /** Clave de i18n del subtítulo, para la cabecera de las pantallas nuevas. */
  subtitleKey: string;
  href: string;
  icon: LucideIcon;
  /** `pending`: la ruta existe, pero solo con el estado vacío "viene en camino". */
  status: 'ready' | 'pending';
  /** Activo solo con la ruta exacta (Hoy); el resto, por prefijo. */
  exact?: boolean;
}

export interface AppNavGroup {
  id: AppNavGroupId;
  labelKey: string;
  items: AppNavItem[];
}

function item(
  id: AppNavItemId,
  href: string,
  icon: LucideIcon,
  status: AppNavItem['status'] = 'ready',
  exact = false,
): AppNavItem {
  return {
    id,
    labelKey: `shell.items.${id}.name`,
    subtitleKey: `shell.items.${id}.subtitle`,
    href,
    icon,
    status,
    ...(exact ? { exact } : {}),
  };
}

export const APP_NAV: readonly AppNavGroup[] = [
  {
    id: 'operations',
    labelKey: 'shell.groups.operations',
    items: [
      item('today', '/dashboard', Home, 'ready', true),
      item('inbox', '/dashboard/conversations', Inbox),
      item('contacts', '/dashboard/contacts', Users),
      item('pipeline', '/dashboard/funnel', Filter),
      item('calendar', '/dashboard/calendar', Calendar),
    ],
  },
  {
    id: 'agents',
    labelKey: 'shell.groups.agents',
    items: [
      item('agents', '/dashboard/agents', Bot),
      item('training', '/dashboard/training', GraduationCap, 'pending'),
      item('knowledge', '/dashboard/knowledge', BookOpen, 'pending'),
    ],
  },
  {
    id: 'business',
    labelKey: 'shell.groups.business',
    items: [
      item('reports', '/dashboard/reports', LineChart, 'pending'),
      item('billing', '/dashboard/billing', CreditCard),
      item('settings', '/dashboard/settings', Settings),
    ],
  },
];

export const APP_NAV_ITEMS: readonly AppNavItem[] = APP_NAV.flatMap((g) => g.items);

export function getNavItem(id: AppNavItemId): AppNavItem {
  const found = APP_NAV_ITEMS.find((i) => i.id === id);
  if (!found) throw new Error(`Unknown nav item: ${id}`);
  return found;
}

function matches(navItem: AppNavItem, pathname: string): boolean {
  if (navItem.exact) return pathname === navItem.href;
  return pathname === navItem.href || pathname.startsWith(`${navItem.href}/`);
}

/** Ítem activo para una ruta (por prefijo, salvo Hoy). `null` si ninguno coincide. */
export function activeNavItem(pathname: string): AppNavItem | null {
  return APP_NAV_ITEMS.find((i) => matches(i, pathname)) ?? null;
}

/** La Bandeja usa el riel encogido. */
export function isInboxRoute(pathname: string): boolean {
  return matches(getNavItem('inbox'), pathname);
}
