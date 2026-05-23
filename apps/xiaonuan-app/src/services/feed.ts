import { api } from './api';
import { File as FileSystemFile } from 'expo-file-system';

export interface FeedItem {
  id: string;
  date: string;
  time: string;
  category: string;
  title: string;
  content: string;
  acknowledged: boolean;
}

export interface FeedListResponse {
  data: FeedItem[];
  nextCursor: string | null;
}

export async function listFeeds(token: string, pairingId: string, cursor?: string) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return api<FeedListResponse>(`/api/pairings/${pairingId}/feeds${query}`, { token });
}

export async function createFeed(token: string, pairingId: string, content: string) {
  return api(`/api/pairings/${pairingId}/feeds`, {
    method: 'POST',
    token,
    body: JSON.stringify({ type: 'TEXT', content }),
  });
}

export async function createVoiceFeed(token: string, pairingId: string, audioUri: string) {
  // 使用新的 File API 读取音频文件为 base64
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
