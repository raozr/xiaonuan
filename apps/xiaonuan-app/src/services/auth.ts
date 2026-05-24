import { api } from './api';

export interface LoginInput {
  phone: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  phone: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    phone: string;
  };
}

export async function login(input: LoginInput) {
  return api('/api/pc-auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  }) as Promise<LoginResponse>;
}

export async function register(input: RegisterInput) {
  return api('/api/pc-auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  }) as Promise<LoginResponse>;
}

export async function getMe(token: string) {
  return api('/api/me', { token }) as Promise<{
    role: string;
    name: string;
    phone: string;
    pairingCount?: number;
  }>;
}

export async function updatePassword(token: string, data: { oldPassword: string; newPassword: string }): Promise<{ success: boolean; message: string }> {
  return api('/api/me/password', {
    method: 'PUT',
    token,
    body: JSON.stringify(data),
  }) as Promise<{ success: boolean; message: string }>;
}
