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
  // Bind methods
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

// Import app.js after mocks are set up
await import('./app.js');

describe('App auto-login flow', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    requestMocks = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should auto-login with silent-login when no token exists', async () => {
    // Simulate existing child user
    requestMocks.push({
      url: 'http://localhost:3000/api/auth/silent-login',
      response: {
        statusCode: 200,
        data: { success: true, token: 'auto_token_123', role: 'CHILD' },
      },
    });
    requestMocks.push({
      url: 'http://localhost:3000/api/me',
      response: {
        statusCode: 200,
        data: { name: '小李', role: 'CHILD' },
      },
    });

    await appInstance.checkLoginStatus();

    expect(wx.login).toHaveBeenCalled();
    expect(wx.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://localhost:3000/api/auth/silent-login',
        method: 'POST',
        data: { code: 'test_wx_code' },
      })
    );
    expect(wx.setStorageSync).toHaveBeenCalledWith('xiaonuan_token', 'auto_token_123');
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/child-home/child-home' });
  });

  it('should redirect to role-select for new user', async () => {
    // Simulate new user (openid not found)
    requestMocks.push({
      url: 'http://localhost:3000/api/auth/silent-login',
      response: {
        statusCode: 200,
        data: { success: false, needRegister: true },
      },
    });

    await appInstance.checkLoginStatus();

    expect(wx.login).toHaveBeenCalled();
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/role-select/role-select' });
  });

  it('should redirect to role-select on silent-login error', async () => {
    // Simulate network error — do not provide a mock for silent-login URL
    // so wx.request falls through to fail handler
    requestMocks = [];

    await appInstance.checkLoginStatus();

    expect(wx.login).toHaveBeenCalled();
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/role-select/role-select' });
  });

  it('should use existing token if valid', async () => {
    wx.getStorageSync = vi.fn((key) => {
      if (key === 'xiaonuan_token') return 'existing_token';
      return '';
    });

    requestMocks.push({
      url: 'http://localhost:3000/api/me',
      response: {
        statusCode: 200,
        data: { name: '张爷爷', role: 'ELDER' },
      },
    });

    await appInstance.checkLoginStatus();

    expect(wx.login).not.toHaveBeenCalled();
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/elder-home/elder-home' });
  });
});
