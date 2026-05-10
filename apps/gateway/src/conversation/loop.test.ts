import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleVoiceText } from './loop.js';
import { prisma } from '@xiaonuan/prisma';
import { createPiAgent } from '../agent/pi-agent.js';

vi.mock('../agent/pi-agent.js', () => ({
  createPiAgent: vi.fn(),
}));

describe('Conversation Loop', () => {
  let mockSocket: any;
  let mockAgent: any;

  beforeEach(() => {
    mockSocket = {
      send: vi.fn(),
    };
    mockAgent = {
      processMessage: vi.fn().mockResolvedValue('小暖听到了：「你好」。我在呢，想多聊聊吗？'),
    };
    vi.mocked(createPiAgent).mockResolvedValue(mockAgent);
    vi.clearAllMocks();
  });

  it('should process voice_text and send ai_text response', async () => {
    const family = await prisma.family.create({
      data: {
        inviteCode: `conv-${Date.now()}`,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        elder: { create: { name: '测试老人' } },
      },
    });
    const session = await prisma.session.create({
      data: {
        familyId: family.id,
        phase: 'ACTIVE_CHAT',
        turnCount: 0,
      },
    });

    await handleVoiceText(session.id, family.id, '你好', mockSocket);

    // Verify AI response sent
    await new Promise((r) => setTimeout(r, 100));
    const sentMessages = mockSocket.send.mock.calls.map((call: any) =>
      JSON.parse(call[0])
    );
    const aiMsg = sentMessages.find((m: any) => m.type === 'message:ai_text');
    expect(aiMsg).toBeDefined();
    expect(aiMsg.payload.text).toContain('小暖听到了');

    // Verify turn count incremented
    const updatedSession = await prisma.session.findUnique({
      where: { id: session.id },
    });
    expect(updatedSession!.turnCount).toBe(1);

    // Verify messages persisted
    const messages = await prisma.sessionMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(messages).toHaveLength(2);
    expect(messages[0]!.role).toBe('ELDER');
    expect(messages[0]!.content).toBe('你好');
    expect(messages[1]!.role).toBe('AI');
    expect(messages[1]!.content).toContain('小暖听到了');

    // Cleanup
    await prisma.sessionMessage.deleteMany({ where: { sessionId: session.id } });
    await prisma.session.delete({ where: { id: session.id } });
    await prisma.family.delete({ where: { id: family.id } });
  });
});
