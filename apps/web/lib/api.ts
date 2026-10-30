const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

// Access token stored in module scope — never in localStorage
let accessToken: string | null = null;

export const getAccessToken = (): string | null => accessToken;
export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiErrorBody {
  error?: {
    message?: string;
    code?: string;
    details?: Record<string, unknown>;
  };
  message?: string;
}

async function parseError(res: Response): Promise<ApiError> {
  let body: ApiErrorBody = {};
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    // ignore
  }
  const message = body.error?.message ?? body.message ?? res.statusText ?? 'Unknown error';
  const code = body.error?.code;
  return new ApiError(res.status, message, code, body.error?.details);
}

// Only these backend codes (middleware/auth.ts) mean "session expired". Any other 401 is a business
// error (e.g. CODE_EXCHANGE_FAILED) and must be propagated, never retried. Reads a clone so the
// original body stays available for parseError.
async function isSessionExpired(res: Response): Promise<boolean> {
  try {
    const body = (await res.clone().json()) as ApiErrorBody;
    const code = body.error?.code;
    return code === 'UNAUTHORIZED' || code === 'INVALID_TOKEN';
  } catch {
    return false;
  }
}

let isRefreshing = false;
let pendingRequests: Array<() => void> = [];

async function tryRefresh(): Promise<boolean> {
  if (isRefreshing) {
    return new Promise((resolve) => {
      pendingRequests.push(() => resolve(true));
    });
  }
  isRefreshing = true;
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      accessToken = null;
      return false;
    }
    const data = (await res.json()) as { accessToken: string };
    accessToken = data.accessToken;
    pendingRequests.forEach((fn) => fn());
    return true;
  } catch {
    accessToken = null;
    return false;
  } finally {
    isRefreshing = false;
    pendingRequests = [];
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retried = false
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (res.status === 401 && !retried && (await isSessionExpired(res))) {
    // Don't attempt refresh for auth endpoints — their 401s mean "invalid credentials", not "expired session"
    const isAuthEndpoint = path.startsWith('/api/auth/');
    if (!isAuthEndpoint) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        return request<T>(path, options, true);
      }
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard')) {
        window.location.href = '/login';
      }
      throw new ApiError(401, 'Session expired');
    }
    // For auth endpoints, propagate the actual backend error
    throw await parseError(res);
  }

  if (!res.ok) {
    const err = await parseError(res);
    if (res.status === 403 && err.code === 'ORG_SUSPENDED' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('org:suspended'));
    }
    throw err;
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export interface DownloadResult {
  blob: Blob;
  // From Content-Disposition; null when the header is missing or not exposed by CORS
  filename: string | null;
}

// Authenticated binary download (a plain browser navigation cannot send the in-memory access token)
async function download(path: string, retried = false): Promise<DownloadResult> {
  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    credentials: 'include',
    headers,
  });

  if (res.status === 401 && !retried && (await isSessionExpired(res))) {
    if (await tryRefresh()) return download(path, true);
    throw new ApiError(401, 'Session expired');
  }
  if (!res.ok) throw await parseError(res);

  const disposition = res.headers.get('Content-Disposition');
  const match = disposition ? /filename="?([^";]+)"?/i.exec(disposition) : null;
  return { blob: await res.blob(), filename: match?.[1] ?? null };
}

export const api = {
  download,
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'DELETE', body: body !== undefined ? JSON.stringify(body) : undefined }),
  upload: <T>(path: string, formData: FormData) => {
    // Don't set Content-Type — browser sets it with boundary for multipart
    const headers: Record<string, string> = {};
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    return fetch(`${API_BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData,
    }).then(async (res) => {
      if (res.status === 401 && (await isSessionExpired(res))) {
        const refreshed = await tryRefresh();
        if (refreshed) {
          const headers2: Record<string, string> = {};
          if (accessToken) headers2['Authorization'] = `Bearer ${accessToken}`;
          return fetch(`${API_BASE}${path}`, {
            method: 'POST',
            credentials: 'include',
            headers: headers2,
            body: formData,
          }).then(async (r) => {
            if (!r.ok) throw await parseError(r);
            return r.json() as Promise<T>;
          });
        }
        throw new ApiError(401, 'Session expired');
      }
      if (!res.ok) throw await parseError(res);
      return res.json() as Promise<T>;
    });
  },
};
