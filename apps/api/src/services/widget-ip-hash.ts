/**
 * Network identity of a web widget session: HMAC-SHA256 of the client IP, keyed with a server
 * secret and a domain prefix, stored as conversations.channel_metadata.ip_hash. The IP itself is
 * never stored or logged by this module. IPv6 is reduced to its /64 (a single client usually owns
 * a whole /64, so rotating addresses inside it does not give a new identity); IPv4-mapped IPv6
 * ("::ffff:1.2.3.4") is treated as IPv4.
 */
import { createHmac } from 'crypto';
import { isIPv4, isIPv6 } from 'net';

const DOMAIN = 'gensmart:widget-ip-hash:v1:';

/** Expands an IPv6 address to 8 groups of 4 hex digits; null when it is not valid IPv6. */
function expandIPv6(ip: string): string[] | null {
  if (!isIPv6(ip)) return null;
  let addr = ip.toLowerCase().split('%')[0]!;
  // Embedded IPv4 tail ("::ffff:1.2.3.4") → two hex groups.
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(addr);
  if (v4) {
    const p = v4[1]!.split('.').map(Number);
    addr = addr.slice(0, -v4[1]!.length) + `${((p[0]! << 8) | p[1]!).toString(16)}:${((p[2]! << 8) | p[3]!).toString(16)}`;
  }
  const [head, tail] = addr.split('::') as [string, string | undefined];
  const h = head ? head.split(':') : [];
  const t = tail !== undefined && tail !== '' ? tail.split(':') : [];
  const fill = tail !== undefined ? 8 - h.length - t.length : 0;
  const groups = [...h, ...Array<string>(Math.max(0, fill)).fill('0'), ...t];
  return groups.length === 8 ? groups.map((g) => g.padStart(4, '0')) : null;
}

/** Network key that is hashed: the IPv4 address, or the /64 prefix of an IPv6 address. Null if invalid. */
export function widgetNetworkKey(ip: string): string | null {
  const raw = ip.trim();
  if (isIPv4(raw)) return `4:${raw}`;
  const g = expandIPv6(raw);
  if (!g) return null;
  if (g.slice(0, 5).every((x) => x === '0000') && g[5] === 'ffff') {
    const a = parseInt(g[6]!, 16);
    const b = parseInt(g[7]!, 16);
    return `4:${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`;
  }
  return `6:${g.slice(0, 4).join(':')}::/64`;
}

/** 64 hex chars, or null when the IP is unknown / invalid (then no network cap applies). */
export function hashWidgetIp(ip: string, secret: string): string | null {
  const key = widgetNetworkKey(ip);
  if (!key || !secret) return null;
  return createHmac('sha256', secret).update(DOMAIN + key).digest('hex');
}
