import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWebSocketHandler } from './session-handler.js';
import { prisma } from '@xiaonuan/prisma';

vi.mock('../conversation/loop.js', () => ({
  handleVoiceText: vi.fn(),
  sendClosingMessage: vi.fn().mockResolvedValue(undefined),
}));

describe('WebSocket Session Handler', () => {
  let mockSocket: any;
  let messageHandler: ((data: string) => void) | undefined;
  let mockApp: any;
  let handler: any;
  let testFamily: any;

  beforeEach(async () => {
    messageHandler = undefined;
    mockSocket = {
      on: vi.fn((event: string, handler: any) => {
        if (event === 'message') messageHandler = handler;
      }),
      send: vi.fn(),
      close: vi.fn(),
    };

    testFamily = await prisma.family.create({
      data: {
        inviteCode: Math.floor(100000 + Math.random() * 900000).toString(),
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        elder: { create: { name: '测试老人' } },
      },
    });

    mockApp = {
      jwt: {
        verify: vi.fn(() => ({
          familyId: testFamily.id,
          role: 'ELDER',
        })),
      },
    };

    handler = createWebSocketHandler(mockApp);
  });

  afterEach(async () => {
    await prisma.sessionMessage.deleteMany({
      where: { session: { familyId: testFamily.id } },
    });
    await prisma.session.deleteMany({ where: { familyId: testFamily.id } });
    await prisma.family.delete({ where: { id: testFamily.id } });
  });

  it('should close connection when JWT is missing', async () => {
    const req = { query: {}, headers: {} } as any;
    await handler(mockSocket, req);
    expect(mockSocket.close).toHaveBeenCalled();
  });

  it('should create a session on session:create message', async () => {
    const req = {
      query: { token: 'valid-jwt' },
      headers: {},
    } as any;

    await handler(mockSocket, req);
    expect(messageHandler).toBeDefined();

    messageHandler!(JSON.stringify({ type: 'session:create', payload: {} }));

    // Wait for async DB operation
    await new Promise((r) => setTimeout(r, 100));

    const sentMessages = mockSocket.send.mock.calls.map((call: any) =>
      JSON.parse(call[0])
    );
    const createdMsg = sentMessages.find((m: any) => m.type === 'session:created');
    expect(createdMsg).toBeDefined();
    expect(createdMsg.payload.sessionId).toBeDefined();

    const session = await prisma.session.findFirst({
      where: { familyId: testFamily.id },
    });
    expect(session).not.toBeNull();
    expect(session!.phase).toBe('GREETING');
  });

  it('should resume an existing session on session:resume', async () => {
    const session = await prisma.session.create({
      data: {
        familyId: testFamily.id,
        phase: 'ACTIVE_CHAT',
      },
    });

    const req = {
      query: { token: 'valid-jwt' },
      headers: {},
    } as any;

    await handler(mockSocket, req);
    messageHandler!(
      JSON.stringify({ type: 'session:resume', payload: { sessionId: session.id } })
    );

    await new Promise((r) => setTimeout(r, 100));

    const sentMessages = mockSocket.send.mock.calls.map((call: any) =>
      JSON.parse(call[0])
    );
    const resumedMsg = sentMessages.find((m: any) => m.type === 'session:resumed');
    expect(resumedMsg).toBeDefined();
    expect(resumedMsg.payload.sessionId).toBe(session.id);
  });

  it('should send ping every 30s and disconnect after 2 missed pongs', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const req = {
      query: { token: 'valid-jwt' },
      headers: {},
    } as any;

    await handler(mockSocket, req);

    // Heartbeat starts immediately after auth
    vi.advanceTimersByTime(30000);
    const firstPing = JSON.parse(mockSocket.send.mock.calls[0][0]);
    expect(firstPing.type).toBe('ping');
    expect(typeof firstPing.timestamp).toBe('number');

    // No pong sent, second ping after another 30s
    vi.advanceTimersByTime(30000);
    const pingCalls = mockSocket.send.mock.calls.filter((call: any) => {
      const msg = JSON.parse(call[0]);
      return msg.type === 'ping';
    });
    expect(pingCalls.length).toBe(2);

    // After another 30s (2 missed pongs), connection should close
    vi.advanceTimersByTime(30000);
    expect(mockSocket.close).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('should transition to CLOSING after 30s silence from GREETING', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const req = {
      query: { token: 'valid-jwt' },
      headers: {},
    } as any;

    await handler(mockSocket, req);
    messageHandler!(JSON.stringify({ type: 'session:create', payload: {} }));

    // Wait for prisma session creation + resetSilenceTimer registration
    await new Promise((r) => setTimeout(r, 200));

    // Fast-forward 30s silence
    vi.advanceTimersByTime(30000);

    // Wait for handleSilence async operations
    await new Promise((r) => setTimeout(r, 200));

    const sentMessages = mockSocket.send.mock.calls.map((call: any) =>
      JSON.parse(call[0])
    );
    const phaseChanged = sentMessages.find(
      (m: any) => m.type === 'phase:changed'
    );
    expect(phaseChanged).toBeDefined();
    expect(phaseChanged.payload.phase).toBe('CLOSING');

    vi.useRealTimers();
  });

  it('should not re-trigger CLOSING after already in CLOSING state', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const req = {
      query: { token: 'valid-jwt' },
      headers: {},
    } as any;

    await handler(mockSocket, req);
    messageHandler!(JSON.stringify({ type: 'session:create', payload: {} }));

    await new Promise((r) => setTimeout(r, 200));

    // First 30s silence -> CLOSING
    vi.advanceTimersByTime(30000);
    await new Promise((r) => setTimeout(r, 200));

    const phaseChanges = mockSocket.send.mock.calls
      .map((call: any) => JSON.parse(call[0]))
      .filter((m: any) => m.type === 'phase:changed' && m.payload.phase === 'CLOSING');
    expect(phaseChanges).toHaveLength(1);

    // Advance another 30s - timer should be cleared, no duplicate CLOSING
    vi.advanceTimersByTime(30000);
    await new Promise((r) => setTimeout(r, 200));

    const phaseChangesAfter = mockSocket.send.mock.calls
      .map((call: any) => JSON.parse(call[0]))
      .filter((m: any) => m.type === 'phase:changed' && m.payload.phase === 'CLOSING');
    expect(phaseChangesAfter).toHaveLength(1);

    vi.useRealTimers();
  });
});
