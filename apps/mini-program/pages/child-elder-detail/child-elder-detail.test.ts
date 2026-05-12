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
};

(global as any).getApp = vi.fn(() => mockApp);

(global as any).wx = {
  navigateTo: vi.fn(),
  reLaunch: vi.fn(),
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
await import('./child-home.js');

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

describe('child-home page', () => {
  beforeEach(() => {
    requestMocks = [];
    pageInstance = null;
    vi.clearAllMocks();
  });

  it('should show guide when elder name is default "老人"', async () => {
    requestMocks.push({
      url: '/api/family',
      method: 'GET',
      response: {
        statusCode: 200,
        data: { elder: { name: '老人' } },
      },
    });

    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad();
    await Promise.resolve();

    expect(p.data.showGuide).toBe(true);
  });

  it('should hide guide when elder name is not default', async () => {
    requestMocks.push({
      url: '/api/family',
      method: 'GET',
      response: {
        statusCode: 200,
        data: { elder: { name: '王奶奶' } },
      },
    });

    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad();
    await Promise.resolve();

    expect(p.data.showGuide).toBe(false);
  });

  it('should navigate to child-settings when guide "去完善" is tapped', async () => {
    requestMocks.push({
      url: '/api/family',
      method: 'GET',
      response: {
        statusCode: 200,
        data: { elder: { name: '老人' } },
      },
    });

    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad();
    await Promise.resolve();

    p.goToFamily();

    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/child-settings/child-settings',
    });
  });

  it('should reload family info on show and hide guide if updated', async () => {
    requestMocks.push({
      url: '/api/family',
      method: 'GET',
      response: {
        statusCode: 200,
        data: { elder: { name: '老人' } },
      },
    });

    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad();
    await Promise.resolve();

    expect(p.data.showGuide).toBe(true);

    // Simulate returning from settings with updated info
    requestMocks = [{
      url: '/api/family',
      method: 'GET',
      response: {
        statusCode: 200,
        data: { elder: { name: '王奶奶' } },
      },
    }];

    await p.onShow();
    await Promise.resolve();

    expect(p.data.showGuide).toBe(false);
    expect(p.data.familyInfo.elder.name).toBe('王奶奶');
  });
});
