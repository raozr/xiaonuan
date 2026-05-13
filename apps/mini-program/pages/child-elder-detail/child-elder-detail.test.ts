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

  it('should load family info and set elder name first char', async () => {
    requestMocks.push({
      url: '/api/family/f1',
      method: 'GET',
      response: {
        statusCode: 200,
        data: { id: 'f1', elder: { name: '王奶奶' }, inviteCode: '123456' },
      },
    });
    requestMocks.push({
      url: '/api/family/f1/daily-summary',
      method: 'GET',
      response: {
        statusCode: 200,
        data: { success: true, data: null },
      },
    });

    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad({ familyId: 'f1' });
    await Promise.resolve();

    expect(p.data.familyId).toBe('f1');
    expect(p.data.userInfo).toEqual(mockApp.globalData.userInfo);
    expect(p.data.familyInfo.elder.name).toBe('王奶奶');
    expect(p.data.elderNameFirstChar).toBe('王');
    expect(p.data.inviteCode).toBe('123456');
    expect(p.data.todayDate).toMatch(/^[A-Za-z]+ \d+, \d{4}$/);
  });

  it('should load today summary with real data', async () => {
    requestMocks.push({
      url: '/api/family/f1',
      method: 'GET',
      response: {
        statusCode: 200,
        data: { id: 'f1', elder: { name: '李爷爷' } },
      },
    });
    requestMocks.push({
      url: '/api/family/f1/daily-summary',
      method: 'GET',
      response: {
        statusCode: 200,
        data: {
          success: true,
          data: {
            mood: '开心',
            duration: 45,
            topics: 3,
            highlights: ['聊了大儿子下周回家', '说腰今天好多了'],
            concerns: null,
          },
        },
      },
    });

    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad({ familyId: 'f1' });
    await Promise.resolve();

    expect(p.data.todaySummary).not.toBeNull();
    expect(p.data.todaySummary.mood).toBe('开心');
    expect(p.data.todaySummary.durationText).toBe('45 分钟');
    expect(p.data.todaySummary.highlights).toEqual(['聊了大儿子下周回家', '说腰今天好多了']);
  });

  it('should handle long duration correctly', async () => {
    requestMocks.push({
      url: '/api/family/f1',
      method: 'GET',
      response: {
        statusCode: 200,
        data: { id: 'f1', elder: { name: '李爷爷' } },
      },
    });
    requestMocks.push({
      url: '/api/family/f1/daily-summary',
      method: 'GET',
      response: {
        statusCode: 200,
        data: {
          success: true,
          data: {
            mood: '开心',
            duration: 125,
            topics: 5,
            highlights: [],
            concerns: null,
          },
        },
      },
    });

    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad({ familyId: 'f1' });
    await Promise.resolve();

    expect(p.data.todaySummary.durationText).toBe('2 小时 5 分钟');
  });

  it('should set todaySummary to null when no summary exists', async () => {
    requestMocks.push({
      url: '/api/family/f1',
      method: 'GET',
      response: {
        statusCode: 200,
        data: { id: 'f1', elder: { name: '张奶奶' } },
      },
    });
    requestMocks.push({
      url: '/api/family/f1/daily-summary',
      method: 'GET',
      response: {
        statusCode: 200,
        data: { success: true, data: null },
      },
    });

    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad({ familyId: 'f1' });
    await Promise.resolve();

    expect(p.data.todaySummary).toBeNull();
  });

  it('should navigate to feed page', () => {
    const p = createPageInstance();
    pageInstance = p;
    p.setData({ familyId: 'f1' });
    p.goToFeed();

    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/child-feed/child-feed?familyId=f1',
    });
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
    const p = createPageInstance();
    pageInstance = p;
    p.setData({ inviteCode: '654321' });
    p.copyInviteCode();

    expect(wx.setClipboardData).toHaveBeenCalledWith(
      expect.objectContaining({ data: '654321' })
    );
    expect(wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '邀请码已复制' })
    );
  });

  it('should refresh invite code', async () => {
    requestMocks.push({
      url: '/api/family/f1/refresh-code',
      method: 'POST',
      response: {
        statusCode: 200,
        data: { inviteCode: 'NEW987' },
      },
    });

    const p = createPageInstance();
    pageInstance = p;
    p.setData({ familyId: 'f1', inviteCode: 'OLD123' });
    await p.refreshInviteCode();
    await Promise.resolve();

    expect(p.data.inviteCode).toBe('NEW987');
    expect(wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '邀请码已刷新' })
    );
  });
});
