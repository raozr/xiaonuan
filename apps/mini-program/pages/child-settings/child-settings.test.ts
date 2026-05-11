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
  showToast: vi.fn(),
  showLoading: vi.fn(),
  hideLoading: vi.fn(),
  navigateBack: vi.fn(),
  setClipboardData: vi.fn(({ success }) => success?.()),
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
await import('./child-settings.js');

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

describe('child-settings page', () => {
  beforeEach(() => {
    requestMocks = [];
    pageInstance = null;
    vi.clearAllMocks();
  });

  it('should load family settings on mount and populate form', async () => {
    requestMocks.push({
      url: '/api/family/settings',
      method: 'GET',
      response: {
        statusCode: 200,
        data: {
          family: { id: 'f1', inviteCode: '123456', inviteCodeExpiresAt: new Date().toISOString() },
          elder: {
            name: '王奶奶',
            age: 78,
            dialect: '四川话',
            hobbies: '养花、听京剧',
            healthNotes: '腰不好',
            topicsToAvoid: '已故的老伴',
            greetingPreference: '称呼我老王就行',
          },
          children: [
            { name: '小李', relationshipToElder: '儿子', customNotes: '我在北京工作' },
          ],
        },
      },
    });

    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad();
    await Promise.resolve();

    expect(p.data.elderName).toBe('王奶奶');
    expect(p.data.elderAge).toBe(78);
    expect(p.data.elderDialect).toBe('四川话');
    expect(p.data.elderHobbies).toBe('养花、听京剧');
    expect(p.data.elderHealthNotes).toBe('腰不好');
    expect(p.data.elderTopicsToAvoid).toBe('已故的老伴');
    expect(p.data.elderGreetingPreference).toBe('称呼我老王就行');
    expect(p.data.childName).toBe('小李');
    expect(p.data.childRelationship).toBe('儿子');
    expect(p.data.childCustomNotes).toBe('我在北京工作');
    expect(p.data.inviteCode).toBe('123456');
    expect(p.data.familyMembers).toHaveLength(1);
  });

  it('should update data on input changes', async () => {
    requestMocks.push({
      url: '/api/family/settings',
      method: 'GET',
      response: { statusCode: 200, data: { family: { id: 'f1' }, elder: { name: '张爷爷' }, children: [] } },
    });

    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad();
    await Promise.resolve();

    p.onElderNameInput({ detail: { value: '李爷爷' } });
    expect(p.data.elderName).toBe('李爷爷');

    p.onElderAgeChange({ detail: { value: 30 } });
    expect(p.data.elderAge).toBe(80);

    p.onChildNameInput({ detail: { value: '大明' } });
    expect(p.data.childName).toBe('大明');

    p.onChildRelationshipChange({ detail: { value: 1 } });
    expect(p.data.childRelationship).toBe('儿子');

    p.onChildCustomNotesInput({ detail: { value: '每周回家' } });
    expect(p.data.childCustomNotes).toBe('每周回家');
  });

  it('should validate elder name before saving', async () => {
    requestMocks.push({
      url: '/api/family/settings',
      method: 'GET',
      response: {
        statusCode: 200,
        data: {
          family: { id: 'f1', inviteCode: '123456' },
          elder: { name: '' },
          children: [{ name: '小李' }],
        },
      },
    });

    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad();
    await Promise.resolve();

    p.setData({ elderName: '' });
    await p.save();

    expect(wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '请输入老人姓名' })
    );
  });

  it('should validate elder age range', async () => {
    requestMocks.push({
      url: '/api/family/settings',
      method: 'GET',
      response: {
        statusCode: 200,
        data: {
          family: { id: 'f1', inviteCode: '123456' },
          elder: { name: '张爷爷' },
          children: [{ name: '小李' }],
        },
      },
    });

    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad();
    await Promise.resolve();

    p.setData({ elderAge: 30 });
    await p.save();

    expect(wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '年龄需在 50-120 岁之间' })
    );
  });

  it('should call PUT APIs and navigate back on valid save', async () => {
    requestMocks.push({
      url: '/api/family/settings',
      method: 'GET',
      response: {
        statusCode: 200,
        data: {
          family: { id: 'f1', inviteCode: '123456' },
          elder: { name: '王奶奶', age: 78 },
          children: [{ name: '小李', relationshipToElder: '儿子', customNotes: '我在北京工作' }],
        },
      },
    });
    requestMocks.push({
      url: '/api/family/elder',
      method: 'PUT',
      response: { statusCode: 200, data: { success: true } },
    });
    requestMocks.push({
      url: '/api/me',
      method: 'PUT',
      response: { statusCode: 200, data: { success: true } },
    });

    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad();
    await Promise.resolve();

    await p.save();
    await Promise.resolve();

    expect(mockApp.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/family/elder',
        method: 'PUT',
        data: expect.objectContaining({ name: '王奶奶', age: 78 }),
      })
    );
    expect(mockApp.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/me',
        method: 'PUT',
        data: expect.objectContaining({ name: '小李', relationshipToElder: '儿子' }),
      })
    );
    expect(wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '保存成功' })
    );
    expect(wx.navigateBack).toHaveBeenCalled();
  });

  it('should copy invite code to clipboard', async () => {
    requestMocks.push({
      url: '/api/family/settings',
      method: 'GET',
      response: {
        statusCode: 200,
        data: {
          family: { id: 'f1', inviteCode: '654321' },
          elder: { name: '王奶奶' },
          children: [],
        },
      },
    });

    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad();
    await Promise.resolve();

    p.copyInviteCode();

    expect(wx.setClipboardData).toHaveBeenCalledWith(
      expect.objectContaining({ data: '654321' })
    );
  });
});
