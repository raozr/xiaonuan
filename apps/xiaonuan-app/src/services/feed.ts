import { api } from './api';

export interface FeedItem {
  id: string;
  type: 'TEXT' | 'VOICE';
  date: string;
  time: string;
  category: string;
  title: string;
  content: string;
  audioUrl?: string;
  createdAt: string;
  acknowledged: boolean;
}

export interface FeedListResponse {
  data: FeedItem[];
  nextCursor: string | null;
  success?: boolean;
}

export async function listFeeds(token: string, pairingId: string, cursor?: string) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const response = await api<FeedListResponse | FeedItem[]>(
    `/api/pairings/${pairingId}/feeds${query}`,
    { token }
  );
  const data = Array.isArray(response) ? response : response.data;
  const nextCursor = Array.isArray(response) ? null : response.nextCursor;
  return Object.assign(data, { data, nextCursor });
}

export async function createFeed(token: string, pairingId: string, content: string) {
  return api(`/api/pairings/${pairingId}/feeds`, {
    method: 'POST',
    token,
    body: JSON.stringify({ content }),
  });
}

export async function createVoiceFeed(token: string, pairingId: string, audioUri: string) {
  const { File: FileSystemFile } = await import('expo-file-system');
  const file = new FileSystemFile(audioUri);
  const base64 = await file.base64();

  return api(`/api/pairings/${pairingId}/feeds`, {
    method: 'POST',
    token,
    body: JSON.stringify({ type: 'VOICE', audioBase64: base64 }),
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
