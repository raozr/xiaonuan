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
  navigateBack: vi.fn(),
  reLaunch: vi.fn(),
  login: vi.fn(() => Promise.resolve({ code: 'test_code' })),
  setStorageSync: vi.fn(),
  getStorageSync: vi.fn((key) => {
    if (key === 'xiaonuan_token') return 'test-token';
    return undefined;
  }),
  showToast: vi.fn(),
  setClipboardData: vi.fn(({ success }) => success?.()),
};

(global as any).Page = vi.fn((options) => {
  pageOptions = options;
});
(global as any).getCurrentPages = vi.fn(() => (pageInstance ? [pageInstance] : []));

// Import page after mocks
await import('./bind-family.js');

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

describe('bind-family page', () => {
  beforeEach(() => {
    requestMocks = [];
    pageInstance = null;
    vi.clearAllMocks();
  });

  it('should navigate to child-settings after creating family', async () => {
    requestMocks.push({
      url: '/api/family',
      method: 'POST',
      response: {
        statusCode: 201,
        data: { id: 'f1', inviteCode: '123456', elder: { name: '老人' } },
      },
    });

    const p = createPageInstance();
    pageInstance = p;
    p.setData({ elderName: '王奶奶', elderAge: '78' });
    await p.createFamily();
    await Promise.resolve();

    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/child-settings/child-settings',
    });
  });
});
