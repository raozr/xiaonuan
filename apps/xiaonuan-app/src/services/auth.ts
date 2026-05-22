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
    id: string;
    name: string;
    phone: string;
  }>;
}

export async function updateMe(token: string, data: { name: string }) {
  return api('/api/me', {
    method: 'PUT',
    token,
    body: JSON.stringify(data),
  });
}
