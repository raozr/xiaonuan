import { api } from './api';

export interface EventItem {
  id: string;
  pairingId: string;
  actorId: string | null;
  type: string;
  content: string;
  tags: string[];
  payload: Record<string, unknown> | null;
  eventTime: string;
  createdAt: string;
}

export interface EventListResponse {
  data: EventItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export async function listEvents(
  token: string,
  pairingId: string,
  params?: { type?: string; page?: number; limit?: number }
) {
  const searchParams = new URLSearchParams();
  if (params?.type) searchParams.append('type', params.type);
  if (params?.page) searchParams.append('page', String(params.page));
  if (params?.limit) searchParams.append('limit', String(params.limit));
  const query = searchParams.toString();
  return api<EventListResponse>(
    `/api/pairings/${pairingId}/events${query ? `?${query}` : ''}`,
    { token }
  );
}

export async function getDailySummary(token: string, pairingId: string) {
  return api(`/api/pairings/${pairingId}/daily-summary`, { token });
}

export async function getEvents(token: string, pairingId: string, date: string) {
  return api(`/api/pairings/${pairingId}/events?date=${encodeURIComponent(date)}`, {
    token,
  });
}

export async function getTodayEvents(token: string, pairingId: string) {
  const response = await api<{ data: EventItem[] } | EventItem[]>(
    `/api/pairings/${pairingId}/events/today`,
    { token }
  );
  return Array.isArray(response) ? response : response.data;
}
