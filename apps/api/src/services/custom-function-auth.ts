/**
 * Authentication, query arguments and body of custom_function requests, shared by the production engine
 * (executeCustomFunction) and the Test button (testTool) so that both send the same thing.
 * No app imports, nothing is logged.
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

/**
 * GET and HEAD carry the tool arguments as query parameters (URLSearchParams); undefined and null values
 * are skipped, the rest go through String(). Any other method: the URL is returned unchanged.
 * The query goes before a fragment, with ? or & depending on whether the URL already has a query.
 */
export function appendArgumentsAsQuery(url: string, args: Record<string, unknown>, method: string): string {
  if (!['GET', 'HEAD'].includes(method.toUpperCase())) return url;
  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined && value !== null) {
      queryParams.append(key, String(value));
    }
  }
  const queryString = queryParams.toString();
  return queryString ? appendQuery(url, queryString) : url;
}

/**
 * Substitutes `{{param}}` placeholders with values from `params`. A missing
 * or null value becomes an empty string (with a warning log) instead of
 * leaving the literal `{{param}}` text in the outgoing request — the LLM
 * regularly omits optional parameters it hasn't captured yet.
 *
 * In the `endpoint_url` context every value is URL-encoded: the values come from the model (which an
 * end customer can influence), so "../owners" or "x?archived=true#" must not change the path or the
 * query of the template. encodeURIComponent leaves dots alone, so a value that is exactly "." or ".."
 * (a path traversal segment) is treated as empty. The `body_template` context (JSON) is unchanged.
 */
export function replacePlaceholders(
  template: unknown,
  params: Record<string, unknown>,
  context: string
): unknown {
  if (typeof template === 'string') {
    return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      const val = params[key];
      if (val === undefined || val === null) {
        console.warn(`[custom-function] parámetro "{{${key}}}" no recibido en ${context}, usando valor vacío`);
        return '';
      }
      if (context === 'endpoint_url') {
        const encoded = encodeURIComponent(String(val));
        if (encoded === '.' || encoded === '..') {
          console.warn(`[custom-function] parámetro "{{${key}}}" no válido en ${context}, usando valor vacío`);
          return '';
        }
        return encoded;
      }
      return String(val);
    });
  }
  if (Array.isArray(template)) {
    return template.map((item) => replacePlaceholders(item, params, context));
  }
  if (template !== null && typeof template === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(template as Record<string, unknown>)) {
      result[k] = replacePlaceholders(v, params, context);
    }
    return result;
  }
  return template;
}

/**
 * Serialized request body. GET and HEAD carry no body (their arguments go in the query); any other
 * method sends the body template with its placeholders replaced, or the arguments as they are.
 */
export function buildRequestBody(
  method: string,
  bodyTemplate: unknown,
  args: Record<string, unknown>
): string | undefined {
  if (['GET', 'HEAD'].includes(method.toUpperCase())) return undefined;
  const body = bodyTemplate ? replacePlaceholders(bodyTemplate, args, 'body_template') : args;
  return JSON.stringify(body);
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
