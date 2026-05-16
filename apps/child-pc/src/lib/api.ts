import { getToken } from './auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000';

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
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

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
  familyCount: number;
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

// Family APIs
export interface Family {
  id: string;
  inviteCode: string;
  inviteCodeExpiresAt: string | null;
  clonedVoiceId: string | null;
  elder: ElderProfile;
  isOnline?: boolean;
  lastActive?: string | null;
}

export interface ElderProfile {
  id: string;
  familyId: string;
  name: string;
  gender?: 'MALE' | 'FEMALE';
  age?: number;
  dialect?: string;
  hobbies?: string;
  healthNotes?: string;
  topicsToAvoid?: string;
  greetingPreference?: string;
}

export function fetchFamilies() {
  return request<Family[]>('/family');
}

export function createFamily(data: { elderName: string; elderAge?: number; elderDialect?: string }) {
  return request<Family>('/family', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function fetchFamily(id: string) {
  return request<Family>(`/family/${id}`);
}

export function updateElder(familyId: string, data: Partial<ElderProfile>) {
  return request<{ success: boolean }>(`/family/${familyId}/elder`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function refreshInviteCode(familyId: string) {
  return request<{ inviteCode: string }>(`/family/${familyId}/refresh-code`, {
    method: 'POST',
  });
}

export interface DailySummary {
  id: string;
  familyId: string;
  date: string;
  moodLabel: string;
  duration: number;
  topicCount: number;
  highlights: string[];
  concerns: string | null;
}

export function fetchDailySummary(familyId: string) {
  return request<DailySummary>(`/family/${familyId}/daily-summary`);
}

// Feed APIs
export interface FamilyFeed {
  id: string;
  familyId: string;
  type: 'TEXT' | 'VOICE' | 'PHOTO';
  content: string;
  category: string;
  audioUrl?: string;
  createdAt: string;
}

export function fetchFeeds(familyId: string) {
  return request<FamilyFeed[]>(`/family/${familyId}/feeds`);
}

export function createFeed(familyId: string, data: { type: 'TEXT' | 'VOICE'; content: string; audioUrl?: string }) {
  return request<FamilyFeed>(`/family/${familyId}/feeds`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Voice Clone APIs
export interface VoiceClone {
  id: string;
  familyId: string;
  voiceId: string;
  status: 'PENDING' | 'TRAINING' | 'READY' | 'FAILED';
  sampleUrls: string[];
  createdAt: string;
}

export function fetchVoiceClones(familyId: string) {
  return request<VoiceClone[]>(`/voice-clone?familyId=${familyId}`);
}

export function createVoiceClone(data: { familyId: string; samples: { filename: string; base64: string }[] }) {
  return request<{ success: boolean; voiceId: string; status: string }>('/voice-clone', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function activateVoiceClone(familyId: string, voiceId: string) {
  return request<{ success: boolean }>(`/voice-clone/activate?familyId=${familyId}&voiceId=${voiceId}`, {
    method: 'POST',
  });
}

export function deleteVoiceClone(voiceId: string) {
  return request<{ success: boolean }>(`/voice-clone/${voiceId}`, {
    method: 'DELETE',
  });
}
