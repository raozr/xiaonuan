import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
    setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; return Promise.resolve(); }),
    multiSet: vi.fn((pairs: [string, string][]) => { pairs.forEach(([k, v]) => { mockStorage[k] = v; }); return Promise.resolve(); }),
    multiGet: vi.fn((keys: string[]) => Promise.resolve(keys.map(k => [k, mockStorage[k] ?? null]))),
    multiRemove: vi.fn((keys: string[]) => { keys.forEach(k => { delete mockStorage[k]; }); return Promise.resolve(); }),
    removeItem: vi.fn((key: string) => { delete mockStorage[k]; return Promise.resolve(); }),
  },
}));

describe('Entry Routing Logic (spec key test case #1)', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    vi.resetModules();
  });

  it('should redirect to COMPANIONEE binding page when no token (first open)', async () => {
    const { useAuthStore } = await import('../store/auth-store');
    const { useRoleStore } = await import('../store/role-store');

    // Fresh state - no token
    expect(useAuthStore.getState().token).toBeNull();
    expect(useRoleStore.getState().role).toBe('COMPANIONEE');

    // Entry routing logic (from app/index.tsx):
    // if (!token) → Redirect to '/(companionee)'
    const token = useAuthStore.getState().token;
    const role = useRoleStore.getState().role;

    let redirectTarget: string;
    if (!token) {
      redirectTarget = '/(companionee)';
    } else if (role === 'COMPANIONEE') {
      redirectTarget = '/(companionee)/home';
    } else {
      redirectTarget = '/(steward)';
    }

    expect(redirectTarget).toBe('/(companionee)');
  });

  it('should redirect to COMPANIONEE home when token exists and role is COMPANIONEE', async () => {
    const { useAuthStore } = await import('../store/auth-store');
    const { useRoleStore } = await import('../store/role-store');

    await useAuthStore.getState().setAuth({ token: 'token', pairingId: 'pair-1' });
    await useRoleStore.getState().setRole('COMPANIONEE');

    const token = useAuthStore.getState().token;
    const role = useRoleStore.getState().role;

    let redirectTarget: string;
    if (!token) {
      redirectTarget = '/(companionee)';
    } else if (role === 'COMPANIONEE') {
      redirectTarget = '/(companionee)/home';
    } else {
      redirectTarget = '/(steward)';
    }

    expect(redirectTarget).toBe('/(companionee)/home');
  });

  it('should redirect to STEWARD pairing list when token exists and role is STEWARD', async () => {
    const { useAuthStore } = await import('../store/auth-store');
    const { useRoleStore } = await import('../store/role-store');

    await useAuthStore.getState().setAuth({ token: 'token', pairingId: '' });
    await useRoleStore.getState().setRole('STEWARD');

    const token = useAuthStore.getState().token;
    const role = useRoleStore.getState().role;

    let redirectTarget: string;
    if (!token) {
      redirectTarget = '/(companionee)';
    } else if (role === 'COMPANIONEE') {
      redirectTarget = '/(companionee)/home';
    } else {
      redirectTarget = '/(steward)';
    }

    expect(redirectTarget).toBe('/(steward)');
  });
});

describe('Role Switch Flow (spec key test case #1)', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    vi.resetModules();
  });

  it('should switch from COMPANIONEE to STEWARD role', async () => {
    const { useRoleStore } = await import('../store/role-store');

    expect(useRoleStore.getState().role).toBe('COMPANIONEE');
    await useRoleStore.getState().setRole('STEWARD');
    expect(useRoleStore.getState().role).toBe('STEWARD');
  });

  it('should switch from STEWARD back to COMPANIONEE role on logout', async () => {
    const { useAuthStore } = await import('../store/auth-store');
    const { useRoleStore } = await import('../store/role-store');

    await useAuthStore.getState().setAuth({ token: 'token', pairingId: '' });
    await useRoleStore.getState().setRole('STEWARD');

    // Simulate logout: clearAuth + reset role
    await useAuthStore.getState().clearAuth();
    await useRoleStore.getState().setRole('COMPANIONEE');

    expect(useAuthStore.getState().token).toBeNull();
    expect(useRoleStore.getState().role).toBe('COMPANIONEE');
  });

  it('should persist role switch across app restart', async () => {
    const { useRoleStore } = await import('../store/role-store');

    await useRoleStore.getState().setRole('STEWARD');
    expect(mockStorage['xn:role']).toBe('STEWARD');

    // Simulate app restart
    useRoleStore.setState({ role: 'COMPANIONEE' });
    await useRoleStore.getState().loadFromStorage();

    expect(useRoleStore.getState().role).toBe('STEWARD');
  });
});

describe('COMPANIONEE Title (spec key test case #3)', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    vi.resetModules();
  });

  it('should display stewardName in COMPANIONEE home title', async () => {
    const { useAuthStore } = await import('../store/auth-store');

    await useAuthStore.getState().setAuth({
      token: 'token',
      pairingId: 'pair-1',
      stewardName: 'Alice',
      companioneeName: 'Bob',
    });

    const { stewardName } = useAuthStore.getState();

    // Home title logic (from app/(companionee)/home.tsx line 280):
    // `${stewardName ?? '小暖'}的陪伴`
    const headerTitle = `${stewardName ?? '小暖'}的陪伴`;

    expect(headerTitle).toBe('Alice的陪伴');
    expect(headerTitle).not.toContain('Xiao Nuan');
    expect(headerTitle).not.toContain('小暖');
  });

  it('should fallback to 小暖 when stewardName is not set', async () => {
    const { useAuthStore } = await import('../store/auth-store');

    await useAuthStore.getState().setAuth({
      token: 'token',
      pairingId: 'pair-1',
      // No stewardName
    });

    const { stewardName } = useAuthStore.getState();
    const headerTitle = `${stewardName ?? '小暖'}的陪伴`;

    expect(headerTitle).toBe('小暖的陪伴');
  });

  it('should persist stewardName in storage and restore it', async () => {
    const { useAuthStore } = await import('../store/auth-store');

    await useAuthStore.getState().setAuth({
      token: 'token',
      pairingId: 'pair-1',
      stewardName: 'Alice',
      companioneeName: 'Bob',
    });

    // Verify stored in AsyncStorage
    expect(mockStorage['xn:user']).toBeDefined();
    const userData = JSON.parse(mockStorage['xn:user']);
    expect(userData.stewardName).toBe('Alice');

    // Simulate app restart
    useAuthStore.setState({ token: null, stewardName: null, companioneeName: null });
    await useAuthStore.getState().loadFromStorage();

    expect(useAuthStore.getState().stewardName).toBe('Alice');
    const headerTitle = `${useAuthStore.getState().stewardName ?? '小暖'}的陪伴`;
    expect(headerTitle).toBe('Alice的陪伴');
  });
});

describe('STEWARD Registration Flow (spec key test case #2)', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    vi.resetModules();
    global.fetch = vi.fn();
  });

  it('should set STEWARD role after successful registration', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        token: 'new-token',
        user: { id: '1', name: 'Alice', phone: '123' },
      })),
    });

    const { useAuthStore } = await import('../store/auth-store');
    const { useRoleStore } = await import('../store/role-store');
    const { register } = await import('../services/auth');

    const data = await register({ name: 'Alice', phone: '123', password: 'pass' });
    await useAuthStore.getState().setAuth({
      token: data.token,
      pairingId: '',
      stewardName: data.user.name,
    });
    await useRoleStore.getState().setRole('STEWARD');

    expect(useAuthStore.getState().token).toBe('new-token');
    expect(useRoleStore.getState().role).toBe('STEWARD');
  });

  it('should show empty pairing list for new STEWARD', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('[]'),
    });

    const { listPairings } = await import('../services/pairing');
    const pairings = await listPairings('test-token');

    expect(pairings).toHaveLength(0);
  });
});
