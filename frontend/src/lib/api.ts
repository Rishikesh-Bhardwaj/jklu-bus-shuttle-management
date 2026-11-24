
/**
 * JKLU Bus Shuttle Management System - API Client
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://jklu-bus-shuttle-api.onrender.com/api';

let csrfToken: string | null = null;

export async function fetchCsrfToken(): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/auth/csrf`, {
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error('Unable to obtain CSRF token.');
  }

  const data = await res.json();
  csrfToken = data.csrfToken;

  return csrfToken!;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  const method = (options.method || 'GET').toUpperCase();

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    if (!csrfToken) {
      await fetchCsrfToken();
    }

    headers.set('X-CSRF-Token', csrfToken!);
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type');
  const data =
    contentType && contentType.includes('application/json')
      ? await response.json()
      : await response.text();

  if (!response.ok) {
    const errorMsg =
      data?.error ||
      data?.message ||
      `Request failed with status ${response.status}`;

    const err = new Error(errorMsg);
    (err as any).status = response.status;
    (err as any).data = data;
    throw err;
  }

  return data as T;
}
