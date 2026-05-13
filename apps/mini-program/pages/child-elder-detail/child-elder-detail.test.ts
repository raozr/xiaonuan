import { describe, it, expect, vi, beforeEach } from 'vitest';

let requestMocks: any[] = [];
let pageOptions: any = null;
let pageInstance: any = null;

const mockApp = {
  globalData: {
    apiBase: 'http://localhost:3000',
    token: 'test-token',
    role: 'CHILD',
    userInfo: { name: '小李', role: 'CHILD' },
  },
  request: vi.fn().mockImplementation((options: any) => {
    const mock = requestMocks.find((m) => m.url === options.url && m.method === (options.method || 'GET'));
    if (mock) {
      return Promise.resolve(mock.response);
    }
    return Promise.resolve({ statusCode: 404, data: {} });
  }),
  logout: vi.fn(),
};

(global as any).getApp = vi.fn(() => mockApp);

(global as any).wx = {
  navigateTo: vi.fn(),
  navigateBack: vi.fn(),
  reLaunch: vi.fn(),
  showToast: vi.fn(),
  showModal: vi.fn(({ success }) => success?.({ confirm: true })),
  setClipboardData: vi.fn(({ success }) => success?.()),
  removeStorageSync: vi.fn(),
  getStorageSync: vi.fn((key) => {
    if (key === 'xiaonuan_token') return 'test-token';
    return undefined;
  }),
};

(global as any).Page = vi.fn((options) => {
  pageOptions = options;
});
(global as any).getCurrentPages = vi.fn(() => (pageInstance ? [pageInstance] : []));

// Import page after mocks
await import('./child-elder-detail.js');

function createPageInstance() {
  const inst = {
    ...pageOptions,
    data: { ...pageOptions.data },
    setData(newData: any) {
      this.data = { ...this.data, ...newData };
    },
  };
  Object.keys(pageOptions).forEach((key) => {
    if (typeof pageOptions[key] === 'function') {
      inst[key] = pageOptions[key].bind(inst);
    }
  });
  return inst;
}

describe('child-elder-detail page', () => {
  beforeEach(() => {
    requestMocks = [];
    pageInstance = null;
    vi.clearAllMocks();
  });

  it('should load family info and show guide for default elder name', async () => {
    requestMocks.push({
      url: '/api/family/f1',
      method: 'GET',
      response: {
        statusCode: 200,
        data: { id: 'f1', elder: { name: '老人' }, inviteCode: '12345678' },
      },
    });

    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad({ familyId: 'f1' });
    await Promise.resolve();

    expect(p.data.familyId).toBe('f1');
    expect(p.data.userInfo).toEqual(mockApp.globalData.userInfo);
    expect(p.data.showGuide).toBe(true);
    expect(p.data.inviteCode).toBe('12345678');
  });

  it('should hide guide when elder name is customized', async () => {
    requestMocks.push({
      url: '/api/family/f1',
      method: 'GET',
      response: {
        statusCode: 200,
        data: { id: 'f1', elder: { name: '王奶奶' }, inviteCode: '12345678' },
      },
    });

    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad({ familyId: 'f1' });
    await Promise.resolve();

    expect(p.data.showGuide).toBe(false);
    expect(p.data.familyInfo.elder.name).toBe('王奶奶');
  });

  it('should dismiss guide', async () => {
    requestMocks.push({
      url: '/api/family/f1',
      method: 'GET',
      response: {
        statusCode: 200,
        data: { id: 'f1', elder: { name: '老人' }, inviteCode: '12345678' },
      },
    });

    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad({ familyId: 'f1' });
    await Promise.resolve();

    expect(p.data.showGuide).toBe(true);
    p.dismissGuide();
    expect(p.data.showGuide).toBe(false);
  });

  it('should navigate to settings with familyId', () => {
    const p = createPageInstance();
    pageInstance = p;
    p.setData({ familyId: 'f1' });
    p.goToSettings();

    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/child-settings/child-settings?familyId=f1',
    });
  });

  it('should copy invite code to clipboard', async () => {
    requestMocks.push({
      url: '/api/family/f1',
      method: 'GET',
      response: {
        statusCode: 200,
        data: { id: 'f1', elder: { name: '王奶奶' }, inviteCode: '654321' },
      },
    });

    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad({ familyId: 'f1' });
    await Promise.resolve();

    p.copyInviteCode();

    expect(wx.setClipboardData).toHaveBeenCalledWith(
      expect.objectContaining({ data: '654321' })
    );
  });

  it('should refresh invite code', async () => {
    requestMocks.push({
      url: '/api/family/f1',
      method: 'GET',
      response: {
        statusCode: 200,
        data: { id: 'f1', elder: { name: '王奶奶' }, inviteCode: 'OLD12345' },
      },
    });
    requestMocks.push({
      url: '/api/family/f1/refresh-code',
      method: 'POST',
      response: {
        statusCode: 200,
        data: { inviteCode: 'NEW98765' },
      },
    });

    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad({ familyId: 'f1' });
    await Promise.resolve();

    await p.refreshInviteCode();
    await Promise.resolve();

    expect(p.data.inviteCode).toBe('NEW98765');
    expect(wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '邀请码已刷新' })
    );
  });

  it('should unbind elder on confirm', async () => {
    requestMocks.push({
      url: '/api/family/f1',
      method: 'GET',
      response: {
        statusCode: 200,
        data: { id: 'f1', elder: { name: '王奶奶' } },
      },
    });
    requestMocks.push({
      url: '/api/family/f1/bind',
      method: 'DELETE',
      response: {
        statusCode: 200,
        data: { success: true },
      },
    });

    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad({ familyId: 'f1' });
    await Promise.resolve();

    await p.unbindElder();
    await Promise.resolve();

    expect(mockApp.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/family/f1/bind',
        method: 'DELETE',
      })
    );
    expect(wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '已解绑' })
    );
  });
});
