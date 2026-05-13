import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let appOptions: any = null;
let appInstance: any = null;
let requestMocks: any[] = [];

(global as any).App = vi.fn((options) => {
  appOptions = options;
  appInstance = {
    ...options,
    globalData: { ...options.globalData },
  };
  Object.keys(options).forEach((key) => {
    if (typeof options[key] === 'function') {
      appInstance[key] = options[key].bind(appInstance);
    }
  });
});

(global as any).wx = {
  getStorageSync: vi.fn(() => ''),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
  reLaunch: vi.fn(),
  login: vi.fn(({ success }) => {
    success({ code: 'test_wx_code' });
  }),
  request: vi.fn((options) => {
    const mock = requestMocks.find((m) => m.url === options.url);
    if (mock) {
      options.success?.(mock.response);
    } else {
      options.fail?.(new Error('Network error'));
    }
  }),
};

await import('./app.js');

const API_BASE = appInstance.globalData.apiBase;

describe('App auto-login flow', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    requestMocks = [];
    vi.clearAllMocks();
    wx.getStorageSync = vi.fn(() => '');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should auto-login with silent-login when no token exists', async () => {
    requestMocks.push({
      url: `${API_BASE}/api/auth/silent-login`,
      response: {
        statusCode: 200,
        data: { success: true, token: 'auto_token_123', role: 'CHILD' },
      },
    });

    await appInstance.checkLoginStatus();

    expect(wx.login).toHaveBeenCalled();
    expect(wx.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `${API_BASE}/api/auth/silent-login`,
        method: 'POST',
        data: { code: 'test_wx_code' },
      })
    );
    expect(wx.setStorageSync).toHaveBeenCalledWith('xiaonuan_token', 'auto_token_123');
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/child-home/child-home' });
  });

  it('should redirect to child-register for new user with openid', async () => {
    requestMocks.push({
      url: `${API_BASE}/api/auth/silent-login`,
      response: {
        statusCode: 200,
        data: { success: false, needRegister: true, openid: 'oNEWUSER123' },
      },
    });

    await appInstance.checkLoginStatus();

    expect(wx.login).toHaveBeenCalled();
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/child-register/child-register?openid=oNEWUSER123' });
  });

  it('should redirect to child-register on silent-login error', async () => {
    requestMocks = [];

    await appInstance.checkLoginStatus();

    expect(wx.login).toHaveBeenCalled();
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/child-register/child-register' });
  });

  it('should use existing token if valid', async () => {
    wx.getStorageSync = vi.fn((key) => {
      if (key === 'xiaonuan_token') return 'existing_token';
      return '';
    });

    requestMocks.push({
      url: `${API_BASE}/api/me`,
      response: {
        statusCode: 200,
        data: { name: '小李', role: 'CHILD' },
      },
    });

    await appInstance.checkLoginStatus();

    expect(wx.login).not.toHaveBeenCalled();
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/child-home/child-home' });
  });

  it('should keep token and not redirect on network error when token exists', async () => {
    wx.getStorageSync = vi.fn((key) => {
      if (key === 'xiaonuan_token') return 'existing_token';
      return '';
    });

    requestMocks = [];

    await appInstance.checkLoginStatus();

    expect(wx.login).not.toHaveBeenCalled();
    expect(wx.reLaunch).not.toHaveBeenCalled();
  });
});
