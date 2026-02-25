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
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiErrorBody {
  error?: {
    message?: string;
    code?: string;
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
  return new ApiError(res.status, message, code);
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

  if (res.status === 401 && !retried) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(path, options, true);
    }
    // Only redirect to /login from protected routes — never from public pages
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard')) {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Session expired');
  }

  if (!res.ok) {
    throw await parseError(res);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
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
      if (res.status === 401) {
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
