import { getToken } from './auth';

const isServer = typeof window === 'undefined';
const API_BASE = isServer
  ? (process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000')
  : '/xiaonuan';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const url = `${API_BASE}${path.startsWith('/api') ? path : `/api${path}`}`;

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      data?.message || `HTTP ${response.status}`,
      response.status,
      data
    );
  }

  return data as T;
}

// Auth APIs
export interface AuthResponse {
  success: boolean;
  token?: string;
  role?: string;
  expiresIn?: number;
  message?: string;
}

export function register(data: { name: string; phone: string; password: string }) {
  return request<AuthResponse>('/pc-auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function login(data: { phone: string; password: string }) {
  return request<AuthResponse>('/pc-auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Me APIs
export interface MeResponse {
  role: string;
  name: string;
  phone: string;
  pairingCount: number;
}

export function fetchMe() {
  return request<MeResponse>('/me');
}

export function updateMe(data: { name: string }) {
  return request<{ success: boolean; name: string }>('/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Pairing APIs
export interface Pairing {
  id: string;
  inviteCode: string;
  inviteCodeExpiresAt: string | null;
  companionee?: Companionee;
  isOnline?: boolean;
  lastActive?: string | null;
}

export interface Companionee {
  id: string;
  pairingId: string;
  name: string;
  gender?: 'MALE' | 'FEMALE';
  age?: number;
  dialect?: string;
  hobbies?: string;
  healthNotes?: string;
  topicsToAvoid?: string;
  greetingPreference?: string;
}

export function fetchPairings() {
  return request<Pairing[]>('/pairings');
}

export function createPairing(data: { companioneeName: string; companioneeAge?: number; companioneeDialect?: string }) {
  return request<Pairing>('/pairings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function fetchPairing(id: string) {
  return request<Pairing>(`/pairings/${id}`);
}

export function updateCompanionee(pairingId: string, data: Partial<Companionee>) {
  return request<{ success: boolean }>(`/pairings/${pairingId}/companionee`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function refreshInviteCode(pairingId: string) {
  return request<{ inviteCode: string }>(`/pairings/${pairingId}/refresh-code`, {
    method: 'POST',
  });
}

export interface DailySummary {
  mood: string;
  duration: number;
  topics: number;
  highlights: string[];
  concerns: string | null;
}

export function fetchDailySummary(pairingId: string) {
  return request<{ success: boolean; data: DailySummary | null }>(`/pairings/${pairingId}/daily-summary`);
}

// Feed APIs
export interface Feed {
  id: string;
  pairingId: string;
  type: 'TEXT' | 'VOICE' | 'PHOTO';
  content: string;
  category: string;
  audioUrl?: string;
  createdAt: string;
}

export function fetchFeeds(pairingId: string) {
  return request<{ success: boolean; data: Feed[] }>(`/pairings/${pairingId}/feeds`);
}

export function createFeed(pairingId: string, data: { type: 'TEXT' | 'VOICE'; content: string; audioBase64?: string }) {
  return request<{ success: boolean; data: Feed }>(`/pairings/${pairingId}/feeds`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteFeed(pairingId: string, feedId: string) {
  return request<{ success: boolean }>(`/pairings/${pairingId}/feeds/${feedId}`, {
    method: 'DELETE',
  });
}

// Voice Clone APIs
export interface VoiceClone {
  id: string;
  pairingId: string;
  voiceId: string;
  status: 'PENDING' | 'TRAINING' | 'READY' | 'FAILED';
  sampleUrls: string[];
  createdAt: string;
}

export function fetchVoiceClones(pairingId: string) {
  return request<{ success: boolean; data: VoiceClone[]; activeVoiceId: string }>(`/voice-clone/pairing/${pairingId}`);
}

export function createVoiceClone(data: { pairingId: string; samples: { filename: string; base64: string }[] }) {
  return request<{ success: boolean; voiceId: string; status: string }>('/voice-clone', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function activateVoiceClone(voiceId: string) {
  return request<{ success: boolean }>(`/voice-clone/${voiceId}/activate`, {
    method: 'POST',
  });
}

export function deleteVoiceClone(voiceId: string) {
  return request<{ success: boolean }>(`/voice-clone/${voiceId}`, {
    method: 'DELETE',
  });
}

// Event APIs
export type EventType =
  | 'feed_message'
  | 'conversation_turn'
  | 'conversation_extracted'
  | 'info_extracted'
  | 'mood_change'
  | 'relationship_shift'
  | 'proactive_outreach'
  | 'persona_updated';

export interface Event {
  id: string;
  pairingId: string;
  type: EventType;
  content: string;
  tags: string[];
  payload?: Record<string, unknown>;
  eventTime: string;
  createdAt: string;
}

export interface EventsResponse {
  success: boolean;
  data: Event[];
  pagination?: { page: number; limit: number; total: number };
}

export function fetchEvents(pairingId: string, options?: { type?: EventType; page?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (options?.type) params.set('type', options.type);
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit) params.set('limit', String(options.limit));
  const qs = params.toString();
  return request<EventsResponse>(`/pairings/${pairingId}/events${qs ? `?${qs}` : ''}`);
}

export function fetchTodayEvents(pairingId: string) {
  return request<EventsResponse>(`/pairings/${pairingId}/events/today`);
}
