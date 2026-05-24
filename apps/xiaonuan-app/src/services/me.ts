import { api } from './api';

export interface MeResponse {
  role: string;
  name: string;
  phone: string;
  pairingCount?: number;
}

export async function getMe(token: string): Promise<MeResponse> {
  return api<MeResponse>('/me', { token, method: 'GET' });
}

export interface UpdatePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export async function updatePassword(token: string, data: UpdatePasswordRequest): Promise<{ success: boolean; message: string }> {
  return api<{ success: boolean; message: string }>('/me/password', {
    token,
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
