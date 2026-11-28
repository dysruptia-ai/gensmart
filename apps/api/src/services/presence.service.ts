/**
 * Presencia de la Bandeja (web-45): "en línea" = al menos un socket conectado de esa persona en esa
 * organización. La API corre en una sola instancia (ecosystem.config.cjs: fork, instances: 1), así que
 * basta con contar los sockets en memoria. Si algún día hay varias instancias, se cambia este proveedor
 * por uno en Redis (`presence:<orgId>:<userId>` con TTL y latido) sin tocar a quien lo usa.
 */

export interface PresenceProvider {
  isOnline(orgId: string, userId: string): Promise<boolean>;
  onlineUsers(orgId: string): Promise<string[]>;
}

/** Sockets por organización → persona → cuántos. */
const counts = new Map<string, Map<string, number>>();

export const memoryPresence: PresenceProvider = {
  async isOnline(orgId, userId) {
    return (counts.get(orgId)?.get(userId) ?? 0) > 0;
  },
  async onlineUsers(orgId) {
    return [...(counts.get(orgId)?.entries() ?? [])].filter(([, n]) => n > 0).map(([u]) => u);
  },
};

let provider: PresenceProvider = memoryPresence;

/** Solo para los tests: una presencia fija. */
export function setPresenceProvider(p: PresenceProvider | null): void {
  provider = p ?? memoryPresence;
}

export function isOnline(orgId: string, userId: string): Promise<boolean> {
  return provider.isOnline(orgId, userId);
}

export function onlineUsers(orgId: string): Promise<string[]> {
  return provider.onlineUsers(orgId);
}

/** Un socket se conectó. Devuelve true si la persona pasó a estar en línea. */
export function socketConnected(orgId: string, userId: string): boolean {
  let org = counts.get(orgId);
  if (!org) {
    org = new Map();
    counts.set(orgId, org);
  }
  const n = (org.get(userId) ?? 0) + 1;
  org.set(userId, n);
  return n === 1;
}

/** Un socket se fue. Devuelve true si era el último de esa persona. */
export function socketDisconnected(orgId: string, userId: string): boolean {
  const org = counts.get(orgId);
  const n = (org?.get(userId) ?? 0) - 1;
  if (!org) return false;
  if (n > 0) {
    org.set(userId, n);
    return false;
  }
  org.delete(userId);
  if (org.size === 0) counts.delete(orgId);
  return true;
}
