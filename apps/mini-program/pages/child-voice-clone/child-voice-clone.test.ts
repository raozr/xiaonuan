import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequest = vi.fn();
const mockGetApp = vi.fn(() => ({
  globalData: { apiBase: 'http://localhost:3000' },
  request: mockRequest,
}));

(global as any).getApp = mockGetApp;
(global as any).wx = {
  showToast: vi.fn(),
  showLoading: vi.fn(),
  hideLoading: vi.fn(),
  showModal: vi.fn(() => Promise.resolve({ confirm: true })),
  getRecorderManager: vi.fn(() => ({
    onStart: vi.fn(),
    onStop: vi.fn(),
    onError: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  })),
  getFileSystemManager: vi.fn(() => ({
    readFileSync: vi.fn(() => 'base64data'),
  })),
};

let pageOptions: any = null;
(global as any).Page = vi.fn((options) => {
  pageOptions = options;
});

await import('./child-voice-clone.js');

describe('child-voice-clone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequest.mockReset();
  });

  it('should resolve familyId on load', async () => {
    mockRequest.mockResolvedValueOnce({
      statusCode: 200,
      data: [{ id: 'family-1' }],
    });

    const page = { ...pageOptions, setData: vi.fn((d) => Object.assign(page.data, d)), data: { ...pageOptions.data } };
    await page.onLoad();
    expect(mockRequest).toHaveBeenCalledWith({ url: '/api/family', method: 'GET' });
    expect(page.data.familyId).toBe('family-1');
  });

  it('should load clones', async () => {
    mockRequest
      .mockResolvedValueOnce({ statusCode: 200, data: [{ id: 'family-1' }] })
      .mockResolvedValueOnce({
        statusCode: 200,
        data: { success: true, data: [{ id: 'c1', voiceId: 'v1', status: 'READY', createdAt: '2026-01-01' }] },
      });

    const page = { ...pageOptions, setData: vi.fn((d) => Object.assign(page.data, d)), data: { ...pageOptions.data } };
    await page.onLoad();
    expect(page.data.clones.length).toBe(1);
    expect(page.data.activeVoiceId).toBe('v1');
  });
});
