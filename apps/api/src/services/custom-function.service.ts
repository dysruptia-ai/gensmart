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
    if (responseMapping?.path) {
      const extracted = resolvePath(responseData, responseMapping.path);
      if (responseMapping.displayFormat) {
        return responseMapping.displayFormat.replace(
          /\{\{value\}\}/g,
          String(extracted ?? '')
        );
      }
      return String(extracted ?? JSON.stringify(responseData));
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
