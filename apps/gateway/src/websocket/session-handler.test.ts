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
  let testPairing: any;

  beforeEach(async () => {
    messageHandler = undefined;
    mockSocket = {
      on: vi.fn((event: string, handler: any) => {
        if (event === 'message') messageHandler = handler;
      }),
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1,
    };

    testPairing = await prisma.pairing.create({
      data: {
        name: 'Test Pairing',
        inviteCode: Math.floor(100000 + Math.random() * 900000).toString(),
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        participants: {
          create: { name: '测试老人', role: 'ELDER' },
        },
      },
    });

    mockApp = {
      jwt: {
        verify: vi.fn(() => ({
          pairingId: testPairing.id,
          role: 'ELDER',
        })),
      },
      log: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
    };

    handler = createWebSocketHandler(mockApp);
  });

  afterEach(async () => {
    await prisma.sessionMessage.deleteMany({
      where: { session: { pairingId: testPairing.id } },
    });
    await prisma.session.deleteMany({ where: { pairingId: testPairing.id } });
    await prisma.pairing.delete({ where: { id: testPairing.id } });
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
      where: { pairingId: testPairing.id },
    });
    expect(session).not.toBeNull();
    expect(session!.phase).toBe('GREETING');
  });

  it('should resume an existing session on session:resume', async () => {
    const session = await prisma.session.create({
      data: {
        pairingId: testPairing.id,
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

  it('should transition to CLOSING after 3min silence since last reply', async () => {
    const { handleVoiceText } = await import('../conversation/loop.js');
    vi.mocked(handleVoiceText).mockResolvedValueOnce(undefined);

    vi.useFakeTimers({ shouldAdvanceTime: true });
    const req = {
      query: { token: 'valid-jwt' },
      headers: {},
    } as any;

    await handler(mockSocket, req);
    messageHandler!(JSON.stringify({ type: 'session:create', payload: {} }));

    // Wait for prisma session creation
    await new Promise((r) => setTimeout(r, 200));

    // 新会话在 GREETING 阶段不会自动计时，需先有一次对话
    messageHandler!(
      JSON.stringify({ type: 'message:voice_text', payload: { text: '你好' } })
    );
    await new Promise((r) => setTimeout(r, 200));

    // Fast-forward 3min silence after the reply
    vi.advanceTimersByTime(180000);

    // Wait for handleSilence async operations
    await new Promise((r) => setTimeout(r, 200));

    const sentMessages = mockSocket.send.mock.calls.map((call: any) =>
      JSON.parse(call[0])
    );
    const phaseChangesToClosing = sentMessages.filter(
      (m: any) => m.type === 'phase:changed' && m.payload.phase === 'CLOSING'
    );
    expect(phaseChangesToClosing).toHaveLength(1);

    vi.useRealTimers();
  });

  it('should not re-trigger CLOSING after already in CLOSING state', async () => {
    const { handleVoiceText } = await import('../conversation/loop.js');
    vi.mocked(handleVoiceText).mockResolvedValueOnce(undefined);

    vi.useFakeTimers({ shouldAdvanceTime: true });
    const req = {
      query: { token: 'valid-jwt' },
      headers: {},
    } as any;

    await handler(mockSocket, req);
    messageHandler!(JSON.stringify({ type: 'session:create', payload: {} }));

    await new Promise((r) => setTimeout(r, 200));

    // Trigger a conversation first so timer starts
    messageHandler!(
      JSON.stringify({ type: 'message:voice_text', payload: { text: '你好' } })
    );
    await new Promise((r) => setTimeout(r, 200));

    // First 3min silence -> CLOSING
    vi.advanceTimersByTime(180000);
    await new Promise((r) => setTimeout(r, 200));

    const phaseChanges = mockSocket.send.mock.calls
      .map((call: any) => JSON.parse(call[0]))
      .filter((m: any) => m.type === 'phase:changed' && m.payload.phase === 'CLOSING');
    expect(phaseChanges).toHaveLength(1);

    // Advance another 3min - timer should be cleared, no duplicate CLOSING
    vi.advanceTimersByTime(180000);
    await new Promise((r) => setTimeout(r, 200));

    const phaseChangesAfter = mockSocket.send.mock.calls
      .map((call: any) => JSON.parse(call[0]))
      .filter((m: any) => m.type === 'phase:changed' && m.payload.phase === 'CLOSING');
    expect(phaseChangesAfter).toHaveLength(1);

    vi.useRealTimers();
  });
});
