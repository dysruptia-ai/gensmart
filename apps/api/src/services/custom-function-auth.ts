/**
 * Authentication of custom_function requests, shared by the production engine (executeCustomFunction)
 * and the Test button (testTool) so that both send the same thing. No app imports, nothing is logged.
 *
 * auth.type values (the form saves the first four):
 *  - 'none' / absent: nothing.
 *  - 'bearer': Authorization: Bearer <token>.
 *  - 'api_key_header': header auth.headerName = auth.apiKey (not applied without headerName).
 *  - 'api_key_query': query parameter auth.queryParam = auth.apiKey (not applied without queryParam).
 *  - 'api_key' (legacy): header auth.headerName ?? 'X-API-Key' and, when auth.queryParam is set, also the query parameter.
 */
export interface CustomFunctionAuth {
  type?: string;
  token?: string;
  headerName?: string;
  apiKey?: string;
  queryParam?: string;
}

function appendQuery(url: string, encodedPair: string): string {
  // The query goes before a fragment, if the template has one
  const hashAt = url.indexOf('#');
  const base = hashAt === -1 ? url : url.slice(0, hashAt);
  const fragment = hashAt === -1 ? '' : url.slice(hashAt);
  return `${base}${base.includes('?') ? '&' : '?'}${encodedPair}${fragment}`;
}

export function applyCustomFunctionAuth(input: {
  auth: CustomFunctionAuth | undefined | null;
  headers: Record<string, string>;
  url: string;
}): { headers: Record<string, string>; url: string } {
  const { auth } = input;
  const headers = { ...input.headers };
  let url = input.url;
  if (!auth || typeof auth !== 'object') return { headers, url };

  switch (auth.type) {
    case 'bearer':
      if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`;
      break;
    case 'api_key_header':
      if (auth.headerName && auth.apiKey) headers[auth.headerName] = auth.apiKey;
      break;
    case 'api_key_query':
      if (auth.queryParam && auth.apiKey) {
        url = appendQuery(url, new URLSearchParams([[auth.queryParam, auth.apiKey]]).toString());
      }
      break;
    case 'api_key':
      if (auth.apiKey) {
        headers[auth.headerName ?? 'X-API-Key'] = auth.apiKey;
        if (auth.queryParam) {
          url = appendQuery(url, `${encodeURIComponent(auth.queryParam)}=${encodeURIComponent(auth.apiKey)}`);
        }
      }
      break;
    default:
      break;
  }
  return { headers, url };
}
