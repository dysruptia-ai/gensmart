/** Number of reverse proxies in front of the API. No imports on purpose. */
export function parseTrustProxyHops(raw: string | undefined, isProduction: boolean): number {
  const fallback = isProduction ? 1 : 0;
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return fallback;
  const hops = Number(trimmed);
  return Number.isSafeInteger(hops) ? hops : fallback;
}
