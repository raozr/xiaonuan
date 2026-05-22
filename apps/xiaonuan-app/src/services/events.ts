import { api } from './api';

export interface EventItem {
  id: string;
  time: string;
  title: string;
  content: string;
  icon: string;
  variant: 'action' | 'normal' | 'weather';
}

export interface DailySummary {
  emotion: string;
  conversationTime: string;
  topicCount: number;
  highlights: string[];
  importantNote: string;
}

export async function getDailySummary(token: string, pairingId: string) {
  return api(`/api/pairings/${pairingId}/summary`, { token }) as Promise<DailySummary>;
}

export async function getEvents(token: string, pairingId: string, date?: string) {
  const params = date ? `?date=${date}` : '';
  return api(`/api/pairings/${pairingId}/events${params}`, { token }) as Promise<EventItem[]>;
}

export async function getTodayEvents(token: string, pairingId: string) {
  return api(`/api/pairings/${pairingId}/events/today`, { token }) as Promise<EventItem[]>;
}
