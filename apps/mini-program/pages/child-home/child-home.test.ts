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
  reLaunch: vi.fn(),
  removeStorageSync: vi.fn(),
  getStorageSync: vi.fn((key) => {
    if (key === 'xiaonuan_token') return 'test-token';
    return undefined;
  }),
  showToast: vi.fn(),
  showModal: vi.fn(({ success }) => success?.({ confirm: true })),
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

  it('should fetch families on show', async () => {
    requestMocks.push({
      url: '/api/family',
      method: 'GET',
      response: {
        statusCode: 200,
        data: [
          { id: 'f1', elder: { name: '王奶奶', isOnline: true } },
          { id: 'f2', elder: { name: '张爷爷', isOnline: false } },
        ],
      },
    });

    const p = createPageInstance();
    pageInstance = p;
    await p.onShow();
    await Promise.resolve();

    expect(p.data.families).toHaveLength(2);
    expect(p.data.families[0].elder.name).toBe('王奶奶');
    expect(p.data.loading).toBe(false);
  });

  it('should show empty families array when no families', async () => {
    requestMocks.push({
      url: '/api/family',
      method: 'GET',
      response: {
        statusCode: 200,
        data: [],
      },
    });

    const p = createPageInstance();
    pageInstance = p;
    await p.onShow();
    await Promise.resolve();

    expect(p.data.families).toHaveLength(0);
    expect(p.data.loading).toBe(false);
  });

  it('should navigate to child-add-elder', () => {
    const p = createPageInstance();
    pageInstance = p;
    p.goToAddElder();

    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/child-add-elder/child-add-elder',
    });
  });

  it('should navigate to child-elder-detail with familyId', () => {
    const p = createPageInstance();
    pageInstance = p;
    p.goToDetail({ currentTarget: { dataset: { id: 'f1' } } });

    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/child-elder-detail/child-elder-detail?familyId=f1',
    });
  });

  it('should logout and redirect to register on confirm', () => {
    const p = createPageInstance();
    pageInstance = p;
    p.handleLogout();

    expect(mockApp.logout).toHaveBeenCalled();
    expect(wx.reLaunch).toHaveBeenCalledWith({
      url: '/pages/child-register/child-register',
    });
  });
});
