import { api } from './api';

export interface FeedItem {
  id: string;
  date: string;
  time: string;
  category: string;
  title: string;
  content: string;
  acknowledged: boolean;
}

export async function listFeeds(token: string, pairingId: string) {
  return api(`/api/pairings/${pairingId}/feeds`, { token }) as Promise<FeedItem[]>;
}

export async function createFeed(token: string, pairingId: string, content: string) {
  return api(`/api/pairings/${pairingId}/feeds`, {
    method: 'POST',
    token,
    body: JSON.stringify({ content }),
  });
}

export async function deleteFeed(token: string, pairingId: string, feedId: string) {
  return api(`/api/pairings/${pairingId}/feeds/${feedId}`, {
    method: 'DELETE',
    token,
  });
}

export async function acknowledgeFeed(token: string, pairingId: string, feedId: string) {
  return api(`/api/pairings/${pairingId}/feeds/${feedId}/acknowledge`, {
    method: 'POST',
    token,
  });
}
