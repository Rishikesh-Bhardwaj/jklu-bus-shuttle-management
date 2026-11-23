/**
 * JKLU Bus Shuttle Management System - API Client
 * Configured with automatic CSRF synchronization and HTTP-only cookie support.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

export async function fetchCsrfToken(): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/auth/csrf`, {
    credentials: 'include',
  });
  const data = await res.json();
  return data.csrfToken;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});

  // For state-changing methods, attach X-CSRF-Token header
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    let csrfToken = getCookie('jklu_csrf_token');
    if (!csrfToken) {
      csrfToken = await fetchCsrfToken();
    }
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }
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
  let data: any = null;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = data?.error || data?.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    (err as any).status = response.status;
    (err as any).data = data;
    throw err;
  }

  return data as T;
}

