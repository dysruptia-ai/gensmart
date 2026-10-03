import { safeFetch, UnsafeUrlError } from './safe-url';
import { applyCustomFunctionAuth, appendArgumentsAsQuery, buildRequestBody, replacePlaceholders } from './custom-function-auth';

const CUSTOM_FUNCTION_MAX_BYTES = 1024 * 1024;

interface ToolConfig {
  endpointUrl: string;
  httpMethod?: string;
  headers?: Record<string, string>;
  auth?: {
    type?: 'bearer' | 'api_key' | 'api_key_header' | 'api_key_query' | 'none';
    token?: string;
    headerName?: string;
    apiKey?: string;
    queryParam?: string;
  };
  bodyTemplate?: Record<string, unknown>;
  responseMapping?: {
    path?: string;
    displayFormat?: string;
  };
  timeoutMs?: number;
}

function resolvePath(obj: unknown, path: string): unknown {
  if (!path || !obj) return obj;
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// Shared with the Test button (and used by other services); lives in the pure module next to the auth logic
export { replacePlaceholders } from './custom-function-auth';

function resolveFormatTemplate(format: string, data: unknown): string {
  return format.replace(/\{\{(.+?)\}\}/g, (_match, expr: string) => {
    const trimmed = expr.trim();

    // {{value}} — entire extracted data
    if (trimmed === 'value') {
      return typeof data === 'object' ? JSON.stringify(data) : String(data ?? '');
    }

    // {{length}} — array length
    if (trimmed === 'length') {
      return Array.isArray(data) ? String(data.length) : '0';
    }

    // Resolve path expressions like [0].title, [0].price, name, etc.
    try {
      let current: unknown = data;
      const parts = trimmed.split(/\./).filter(Boolean);

      for (const part of parts) {
        if (current === null || current === undefined) return '';

        // Handle array index: [0], [1], etc.
        const arrayMatch = part.match(/^\[(\d+)\]$/);
        if (arrayMatch) {
          const index = parseInt(arrayMatch[1], 10);
          if (Array.isArray(current)) {
            current = current[index];
          } else {
            return '';
          }
        } else {
          // Handle combined like "[0]fieldName"
          const combinedMatch = part.match(/^\[(\d+)\](.+)$/);
          if (combinedMatch) {
            const index = parseInt(combinedMatch[1], 10);
            const prop = combinedMatch[2];
            if (Array.isArray(current)) {
              current = (current[index] as Record<string, unknown>)?.[prop];
            } else {
              return '';
            }
          } else {
            current = (current as Record<string, unknown>)[part];
          }
        }
      }

      if (current === null || current === undefined) return '';
      return typeof current === 'object' ? JSON.stringify(current) : String(current);
    } catch {
      return `{{${trimmed}}}`;
    }
  });
}

/** Origin and path only: the query string can carry API keys. */
function urlForLog(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return '(invalid url)';
  }
}

export async function executeCustomFunction(
  config: ToolConfig,
  toolArguments: Record<string, unknown>
): Promise<string> {
  const {
    endpointUrl,
    httpMethod = 'POST',
    headers = {},
    auth,
    bodyTemplate,
    responseMapping,
    timeoutMs = 10000,
  } = config;

  if (!endpointUrl) {
    return 'Error: Tool has no endpoint URL configured.';
  }

  console.log(`[custom-function] → ${httpMethod.toUpperCase()} ${urlForLog(endpointUrl)}`);

  // Build URL — substitute {{param}} path params (e.g. .../contacts/{{contact_id}})
  // before appending auth/query params below.
  const substitutedUrl = replacePlaceholders(endpointUrl, toolArguments, 'endpoint_url') as string;

  // Apply auth (shared with the Test button: same type handling in both places)
  const authed = applyCustomFunctionAuth({
    auth,
    headers: { 'Content-Type': 'application/json', ...headers },
    url: substitutedUrl,
  });
  const finalHeaders = authed.headers;

  // For GET/HEAD requests, append tool arguments as query string parameters (shared with the Test button)
  const finalUrl = appendArgumentsAsQuery(authed.url, toolArguments, httpMethod);


  // Execute with timeout (the validation runs on the FINAL url, after substitution)
  try {
    console.log(`[custom-function]   final URL: ${urlForLog(finalUrl)}`);
    console.log(`[custom-function]   headers: ${Object.keys(finalHeaders).join(', ')}`);
    const response = await safeFetch(finalUrl, {
      method: httpMethod.toUpperCase(),
      headers: finalHeaders,
      body: buildRequestBody(httpMethod, bodyTemplate, toolArguments),
      timeoutMs,
      maxBytes: CUSTOM_FUNCTION_MAX_BYTES,
    });

    console.log(`[custom-function] ← ${response.status} ${response.statusText} from ${urlForLog(finalUrl)}`);

    if (!response.ok) {
      // The remote body is never logged or returned: it can contain anything.
      return `Error: HTTP ${response.status} ${response.statusText} from the endpoint.`;
    }

    let responseData: unknown;
    try {
      responseData = await response.json();
    } catch {
      // The parser error can quote the start of the remote body: return a fixed text instead.
      return 'Error: the endpoint did not return valid JSON';
    }

    // Apply response mapping
    // Frontend saves { path, format }, interface expects { path, displayFormat }
    const mappingFormat = responseMapping?.displayFormat ?? (responseMapping as Record<string, unknown>)?.['format'] as string | undefined;

    if (responseMapping?.path) {
      const extracted = resolvePath(responseData, responseMapping.path);
      if (mappingFormat) {
        return resolveFormatTemplate(mappingFormat, extracted);
      }
      // If extracted is an object, stringify it so the LLM gets readable JSON
      if (extracted === null || extracted === undefined) {
        return JSON.stringify(responseData, null, 2);
      }
      return typeof extracted === 'object'
        ? JSON.stringify(extracted, null, 2)
        : String(extracted);
    }

    return typeof responseData === 'string'
      ? responseData
      : JSON.stringify(responseData, null, 2);
  } catch (err: unknown) {
    if (err instanceof UnsafeUrlError && err.code !== 'RESPONSE_TOO_LARGE') {
      return 'Error: the endpoint URL is not allowed';
    }
    if ((err as { code?: string }).code === 'EUNSAFE_ADDRESS') {
      return 'Error: the endpoint URL is not allowed';
    }
    if (err instanceof UnsafeUrlError) {
      return 'Error: the endpoint response is too large';
    }
    if ((err as { name?: string }).name === 'AbortError') {
      console.error(`[custom-function] ✗ Timeout after ${timeoutMs}ms on ${urlForLog(endpointUrl)}`);
      return `Error: Request timed out after ${timeoutMs}ms`;
    }
    console.error(`[custom-function] ✗ Exception on ${urlForLog(endpointUrl)}:`, (err as Error).message);
    return `Error: ${(err as Error).message ?? 'Unknown error calling custom function'}`;
  }
}
