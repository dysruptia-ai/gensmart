interface ToolConfig {
  endpointUrl: string;
  httpMethod?: string;
  headers?: Record<string, string>;
  auth?: {
    type?: 'bearer' | 'api_key' | 'none';
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

function replacePlaceholders(
  template: unknown,
  params: Record<string, unknown>
): unknown {
  if (typeof template === 'string') {
    return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      const val = params[key];
      return val !== undefined ? String(val) : `{{${key}}}`;
    });
  }
  if (Array.isArray(template)) {
    return template.map((item) => replacePlaceholders(item, params));
  }
  if (template !== null && typeof template === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(template as Record<string, unknown>)) {
      result[k] = replacePlaceholders(v, params);
    }
    return result;
  }
  return template;
}

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

  // Build headers
  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Apply auth
  if (auth && auth.type !== 'none') {
    if (auth.type === 'bearer' && auth.token) {
      finalHeaders['Authorization'] = `Bearer ${auth.token}`;
    } else if (auth.type === 'api_key' && auth.apiKey) {
      const headerName = auth.headerName ?? 'X-API-Key';
      finalHeaders[headerName] = auth.apiKey;
    }
  }

  // Build URL (add query param auth if needed)
  let finalUrl = endpointUrl;
  if (auth?.type === 'api_key' && auth.queryParam && auth.apiKey) {
    const separator = finalUrl.includes('?') ? '&' : '?';
    finalUrl = `${finalUrl}${separator}${encodeURIComponent(auth.queryParam)}=${encodeURIComponent(auth.apiKey)}`;
  }

  // For GET/HEAD requests, append tool arguments as query string parameters
  if (['GET', 'HEAD'].includes(httpMethod.toUpperCase())) {
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(toolArguments)) {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    }
    const queryString = queryParams.toString();
    if (queryString) {
      const separator = finalUrl.includes('?') ? '&' : '?';
      finalUrl = `${finalUrl}${separator}${queryString}`;
    }
  }

  // Build body
  const body = bodyTemplate
    ? replacePlaceholders(bodyTemplate, toolArguments)
    : toolArguments;

  // Execute with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(finalUrl, {
      method: httpMethod.toUpperCase(),
      headers: finalHeaders,
      body: ['GET', 'HEAD'].includes(httpMethod.toUpperCase())
        ? undefined
        : JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return `Error: HTTP ${response.status} ${response.statusText} from ${endpointUrl}`;
    }

    const responseData: unknown = await response.json();

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
    clearTimeout(timeoutId);
    if ((err as { name?: string }).name === 'AbortError') {
      return `Error: Request timed out after ${timeoutMs}ms`;
    }
    return `Error: ${(err as Error).message ?? 'Unknown error calling custom function'}`;
  }
}
