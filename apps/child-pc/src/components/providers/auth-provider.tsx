'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, removeToken, setToken } from '@/lib/auth';
import { fetchMe, login as apiLogin, register as apiRegister } from '@/lib/api';

interface User {
  name: string;
  phone: string;
  role: string;
  pairingCount: number;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (name: string, phone: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const loadUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const me = await fetchMe();
      setUser(me);
    } catch {
      removeToken();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(
    async (phone: string, password: string) => {
      const res = await apiLogin({ phone, password });
      if (res.token) {
        setToken(res.token);
        const me = await fetchMe();
        setUser(me);
        router.push('/');
      } else {
        throw new Error(res.message || '登录失败');
      }
    },
    [router]
  );

  const register = useCallback(
    async (name: string, phone: string, password: string) => {
      const res = await apiRegister({ name, phone, password });
      if (res.token) {
        setToken(res.token);
        const me = await fetchMe();
        setUser(me);
        router.push('/');
      } else {
        throw new Error(res.message || '注册失败');
      }
    },
    [router]
  );

  const logout = useCallback(() => {
    removeToken();
    setUser(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
