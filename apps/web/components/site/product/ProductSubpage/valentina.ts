import type { SiteT } from '@/lib/site-i18n';
import type { MockMessage } from './MockChat';

const V = 'site.productShared.valentina';

/**
 * La conversación de Valentina por el apartamento (Agentes y Bandeja).
 * CRM usa la misma, con los datos marcados en los mensajes del cliente.
 */
export function valentinaThread(t: SiteT, override: Partial<Record<1 | 3, MockMessage['text']>> = {}): MockMessage[] {
  return [
    { dir: 'in', text: override[1] ?? t(`${V}.m1`) },
    { dir: 'out', text: t(`${V}.m2`) },
    { dir: 'in', text: override[3] ?? t(`${V}.m3`) },
    { dir: 'out', text: t(`${V}.m4`) },
  ];
}
