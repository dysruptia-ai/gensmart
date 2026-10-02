/**
 * Decides whether a server_url is the legitimate destination of an MCP provider profile, i.e.
 * whether it is safe to send that provider's platform (master) headers to it. No imports on
 * purpose: it must be testable without Redis or the database.
 *
 * Do NOT use findProfileByUrl for this: domain_contains matching lets
 * "mastershop-mcp.gensmart.co.attacker.com" through.
 */

export interface ProviderUrlProfile {
  default_server_url?: string;
  match_strategy: string;
  match_url_pattern: string;
}

function parseHttps(raw: string | undefined): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export function serverUrlMatchesProfile(profile: ProviderUrlProfile, serverUrl: string): boolean {
  const target = parseHttps(serverUrl);
  if (!target) return false;

  const defaultUrl = parseHttps(profile.default_server_url);
  if (defaultUrl) return target.origin === defaultUrl.origin;

  // No usable default URL: only an exact hostname pattern can authorize the destination.
  if (profile.match_strategy !== 'domain_exact') return false;
  return target.hostname.toLowerCase() === profile.match_url_pattern.trim().toLowerCase();
}
