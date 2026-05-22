import { API_URL } from '../utils/constants';

interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  token?: string;
  body?: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(fetchOptions.headers as Record<string, string> || {}),
  };

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as Record<string, string> | null;
      throw new ApiError(response.status, body?.message || body?.error || `HTTP ${response.status}`);
    }

    // Handle 204 No Content
    const text = await response.text();
    if (!text) return null as T;

    return JSON.parse(text) as T;
}
