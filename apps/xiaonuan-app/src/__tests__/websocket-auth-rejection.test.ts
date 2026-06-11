import { act, renderHook } from '@testing-library/react-hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const listeners: Record<string, (state: string) => void> = {};

vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: vi.fn((event: string, handler: (state: string) => void) => {
      listeners[event] = handler;
      return { remove: vi.fn() };
    }),
  },
}));

type CloseEventShape = { code: number; reason: string; target?: unknown };

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;

  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: CloseEventShape) => void) | null = null;
  onerror: ((event: { type: string; target?: unknown }) => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  send = vi.fn();

  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
  });

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  closeWith(code: number, reason: string) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason, target: this });
  }
}

describe('useWebSocket auth rejection handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should stop reconnecting and notify caller after invalid device rejection', async () => {
    const onAuthRejected = vi.fn();
    const { useWebSocket } = await import('../hooks/useWebSocket');

    const { unmount } = renderHook(() => (
      useWebSocket('ws://localhost/ws', 'token', undefined, { onAuthRejected })
    ));

    const socket = MockWebSocket.instances[0]!;
    act(() => {
      socket.open();
      socket.closeWith(1008, 'Invalid device');
    });

    expect(onAuthRejected).toHaveBeenCalledWith('Invalid device');

    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(MockWebSocket.instances).toHaveLength(1);
    unmount();
  });
});
