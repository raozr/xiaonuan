import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// WeChat API mocks
let socketListeners: Record<string, Function[]> = {};
let socketOpen = false;
let sentMessages: any[] = [];

function emitSocketEvent(event: string, data?: any) {
  (socketListeners[event] || []).forEach((fn) => fn(data));
}

function simulateSocketOpen() {
  socketOpen = true;
  emitSocketEvent('open');
}

const mockApp = {
  globalData: {
    apiBase: 'http://localhost:3000',
    token: 'test-token',
    role: 'ELDER',
    userInfo: { name: '张爷爷', role: 'ELDER' },
    familyInfo: { id: 'family-1' },
  },
  request: vi.fn().mockResolvedValue({ statusCode: 200, data: { name: '张爷爷', role: 'ELDER' } }),
};

(global as any).getApp = vi.fn(() => mockApp);

(global as any).wx = {
  connectSocket: vi.fn(({ url }) => {
    socketOpen = false;
    return {};
  }),
  onSocketOpen: vi.fn((fn) => {
    (socketListeners['open'] ||= []).push(fn);
  }),
  onSocketMessage: vi.fn((fn) => {
    (socketListeners['message'] ||= []).push(fn);
  }),
  onSocketClose: vi.fn((fn) => {
    (socketListeners['close'] ||= []).push(fn);
  }),
  onSocketError: vi.fn((fn) => {
    (socketListeners['error'] ||= []).push(fn);
  }),
  sendSocketMessage: vi.fn(({ data }) => {
    sentMessages.push(JSON.parse(data));
  }),
  closeSocket: vi.fn(() => {
    socketOpen = false;
    emitSocketEvent('close');
  }),
  getStorageSync: vi.fn((key) => {
    if (key === 'xiaonuan_token') return 'test-token';
    return undefined;
  }),
  setStorageSync: vi.fn(),
  vibrateShort: vi.fn(),
  reLaunch: vi.fn(),
  removeStorageSync: vi.fn(),
};

// Capture Page registration
let pageOptions: any = null;
let pageInstance: any = null;
(global as any).Page = vi.fn((options) => {
  pageOptions = options;
});
(global as any).getCurrentPages = vi.fn(() => (pageInstance ? [pageInstance] : []));

// Import the page once after mocks are set up
await import('./elder-home.js');

function createPageInstance() {
  const inst = {
    ...pageOptions,
    data: { ...pageOptions.data },
    setData(newData: any) {
      this.data = { ...this.data, ...newData };
    },
  };
  // Bind methods to instance
  Object.keys(pageOptions).forEach((key) => {
    if (typeof pageOptions[key] === 'function') {
      inst[key] = pageOptions[key].bind(inst);
    }
  });
  return inst;
}

describe('elder-home WebSocket integration', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    socketListeners = {};
    socketOpen = false;
    sentMessages = [];
    pageInstance = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create WebSocket on load and send session:create', async () => {
    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad();
    simulateSocketOpen();

    expect(wx.connectSocket).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'ws://localhost:3000/ws?token=test-token',
      })
    );

    const sessionCreate = sentMessages.find((m) => m.type === 'session:create');
    expect(sessionCreate).toBeDefined();
  });

  it('should store sessionId when session:created received', async () => {
    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad();
    simulateSocketOpen();

    emitSocketEvent('message', {
      data: JSON.stringify({ type: 'session:created', payload: { sessionId: 'sess-123' } }),
    });

    expect(p.data.sessionId).toBe('sess-123');
  });

  it('should send message:voice_text on button release', async () => {
    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad();
    simulateSocketOpen();

    emitSocketEvent('message', {
      data: JSON.stringify({ type: 'session:created', payload: { sessionId: 'sess-123' } }),
    });

    p.onTouchStart();
    expect(p.data.isListening).toBe(true);

    // Set mock voice text (simulating STT result)
    p.setData({ voiceText: '你好' });
    p.onTouchEnd();

    expect(p.data.isListening).toBe(false);

    const voiceMsg = sentMessages.find((m) => m.type === 'message:voice_text');
    expect(voiceMsg).toBeDefined();
    expect(voiceMsg.payload.text).toBe('你好');
  });

  it('should display AI response and set isSpeaking', async () => {
    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad();
    simulateSocketOpen();

    emitSocketEvent('message', {
      data: JSON.stringify({ type: 'session:created', payload: { sessionId: 'sess-123' } }),
    });

    emitSocketEvent('message', {
      data: JSON.stringify({ type: 'message:ai_text', payload: { text: '你好呀' } }),
    });

    expect(p.data.aiText).toBe('你好呀');
    expect(p.data.isSpeaking).toBe(true);

    await vi.advanceTimersByTimeAsync(3000);
    expect(p.data.isSpeaking).toBe(false);
    expect(p.data.aiText).toBe('');
  });

  it('should reconnect on socket close up to 3 times with backoff', async () => {
    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad();
    simulateSocketOpen();

    const connectCount = () => (wx.connectSocket as any).mock.calls.length;
    const initialCount = connectCount();

    // 1st close → reconnect after 1s (do not open the reconnect socket)
    emitSocketEvent('close');
    await vi.advanceTimersByTimeAsync(1000);
    expect(connectCount()).toBe(initialCount + 1);

    // 2nd close → reconnect after 2s
    emitSocketEvent('close');
    await vi.advanceTimersByTimeAsync(2000);
    expect(connectCount()).toBe(initialCount + 2);

    // 3rd close → reconnect after 4s
    emitSocketEvent('close');
    await vi.advanceTimersByTimeAsync(4000);
    expect(connectCount()).toBe(initialCount + 3);

    // 4th close should not reconnect (max reached)
    emitSocketEvent('close');
    await vi.advanceTimersByTimeAsync(8000);
    expect(connectCount()).toBe(initialCount + 3);
  });
});
