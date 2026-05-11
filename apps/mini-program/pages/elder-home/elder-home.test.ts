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
  request: vi.fn().mockImplementation((options: any) => {
    if (options.url === '/api/me') {
      return Promise.resolve({ statusCode: 200, data: { name: '张爷爷', role: 'ELDER' } });
    }
    if (options.url === '/api/asr/transcribe') {
      return Promise.resolve({ statusCode: 200, data: { success: true, text: '你好' } });
    }
    if (options.url === '/api/tts/synthesize') {
      return Promise.resolve({ statusCode: 200, data: { success: true, audioUrl: '/tts/test.mp3' } });
    }
    return Promise.resolve({ statusCode: 200, data: {} });
  }),
};

let recorderCallbacks: Record<string, Function> = {};
const mockRecorderManager = {
  start: vi.fn(),
  stop: vi.fn(),
  onStart: vi.fn((fn) => { recorderCallbacks['start'] = fn; }),
  onStop: vi.fn((fn) => { recorderCallbacks['stop'] = fn; }),
  onError: vi.fn((fn) => { recorderCallbacks['error'] = fn; }),
};

const mockFileSystem = {
  readFile: vi.fn(({ success }: any) => {
    success({ data: 'dGVzdGF1ZGlv' });
  }),
};

const mockAudioContext = {
  play: vi.fn(),
  stop: vi.fn(),
  destroy: vi.fn(),
  onPlay: vi.fn((fn) => { mockAudioContext._onPlay = fn; }),
  onEnded: vi.fn((fn) => { mockAudioContext._onEnded = fn; }),
  onError: vi.fn((fn) => { mockAudioContext._onError = fn; }),
  _onPlay: null as Function | null,
  _onEnded: null as Function | null,
  _onError: null as Function | null,
  get obeyMuteSwitch() { return false; },
  set obeyMuteSwitch(_v: boolean) {},
  set src(_v: string) {},
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
  getRecorderManager: vi.fn(() => mockRecorderManager),
  getFileSystemManager: vi.fn(() => mockFileSystem),
  createInnerAudioContext: vi.fn(() => mockAudioContext),
  showToast: vi.fn(),
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
  recorderCallbacks = {};
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

describe('elder-home voice chat flow', () => {
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

  it('should start recorder on touch start and stop on touch end', async () => {
    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad();

    p.onTouchStart();
    expect(p.data.isListening).toBe(true);
    expect(mockRecorderManager.start).toHaveBeenCalledWith({
      format: 'wav',
      sampleRate: 16000,
      numberOfChannels: 1,
      duration: 30000,
    });

    p.onTouchEnd();
    expect(p.data.isListening).toBe(false);
    expect(mockRecorderManager.stop).toHaveBeenCalled();
  });

  it('should send ASR result via WebSocket after recording stops', async () => {
    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad();
    simulateSocketOpen();

    emitSocketEvent('message', {
      data: JSON.stringify({ type: 'session:created', payload: { sessionId: 'sess-123' } }),
    });

    p.onTouchStart();
    p.onTouchEnd();

    // Simulate recorder onStop callback
    const onStopFn = recorderCallbacks['stop'];
    expect(onStopFn).toBeDefined();
    await onStopFn({ tempFilePath: '/tmp/test.wav', duration: 1500 });
    // Allow handleRecordingStop async chain to finish
    await Promise.resolve();

    expect(mockApp.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/asr/transcribe',
        method: 'POST',
      })
    );

    const voiceMsg = sentMessages.find((m) => m.type === 'message:voice_text');
    expect(voiceMsg).toBeDefined();
    expect(voiceMsg.payload.text).toBe('你好');
  });

  it('should skip short recordings', async () => {
    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad();

    p.onTouchStart();
    p.onTouchEnd();

    const onStopFn = recorderCallbacks['stop'];
    await onStopFn({ tempFilePath: '/tmp/test.wav', duration: 300 });

    expect(wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '说话时间太短' })
    );
  });

  it('should display AI response and play TTS audio', async () => {
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
    // Allow synthesizeAndPlay async chain to finish
    await Promise.resolve();

    expect(p.data.aiReplyText).toBe('你好呀');
    expect(p.data.isProcessing).toBe(false);
    expect(p.data.isSpeaking).toBe(true);
    expect(mockApp.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/tts/synthesize',
        method: 'POST',
      })
    );
    expect(mockAudioContext.play).toHaveBeenCalled();
  });

  it('should reconnect on socket close up to 3 times with backoff', async () => {
    const p = createPageInstance();
    pageInstance = p;
    await p.onLoad();
    simulateSocketOpen();

    const connectCount = () => (wx.connectSocket as any).mock.calls.length;
    const initialCount = connectCount();

    // 1st close → reconnect after 1s
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
