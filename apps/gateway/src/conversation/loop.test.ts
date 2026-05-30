import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleVoiceText } from './loop.js';
import { prisma } from '@xiaonuan/prisma';
import { createPiAgent } from '../agent/pi-agent.js';
import { synthesizeForPairing } from '../services/voice.js';

vi.mock('../agent/pi-agent.js', () => ({
  createPiAgent: vi.fn(),
}));

vi.mock('../services/voice.js', () => ({
  synthesizeForPairing: vi.fn(),
}));

describe('Conversation Loop', () => {
  let mockSocket: any;
  let mockAgent: any;

  beforeEach(() => {
    mockSocket = {
      send: vi.fn(),
      readyState: 1,
    };
    mockAgent = {
      processMessage: vi.fn().mockResolvedValue('小暖听到了：「你好」。我在呢，想多聊聊吗？'),
    };
    vi.mocked(createPiAgent).mockResolvedValue(mockAgent);
    vi.mocked(synthesizeForPairing).mockResolvedValue({
      audioBuffer: Buffer.from('mp3'),
      audioUrl: '/tts/mock.mp3',
    });
    vi.clearAllMocks();
  });

  it('should process voice_text and send ai_text response', async () => {
    const pairing = await prisma.pairing.create({
      data: {
        name: 'Test Pairing',
        inviteCode: `conv-${Date.now()}`,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        participants: {
          create: { name: '测试被陪伴者', role: 'COMPANIONEE' },
        },
      },
    });
    const session = await prisma.session.create({
      data: {
        pairingId: pairing.id,
        phase: 'ACTIVE_CHAT',
        turnCount: 0,
      },
    });

    await handleVoiceText(session.id, pairing.id, '你好', mockSocket);

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
    expect(messages[0]!.role).toBe('COMPANIONEE');
    expect(messages[0]!.content).toBe('你好');
    expect(messages[1]!.role).toBe('AI');
    expect(messages[1]!.content).toContain('小暖听到了');

    // Cleanup
    await prisma.sessionMessage.deleteMany({ where: { sessionId: session.id } });
    await prisma.session.delete({ where: { id: session.id } });
    await prisma.pairing.delete({ where: { id: pairing.id } });
  });

  it('should send text before async TTS audio is ready', async () => {
    let resolveTts!: (value: { audioBuffer: Buffer; audioUrl: string }) => void;
    vi.mocked(synthesizeForPairing).mockReturnValue(
      new Promise((resolve) => {
        resolveTts = resolve;
      }) as any
    );

    const pairing = await prisma.pairing.create({
      data: {
        name: 'Test Pairing Async TTS',
        inviteCode: `conv-async-${Date.now()}`,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        participants: {
          create: { name: '测试被陪伴者', role: 'COMPANIONEE' },
        },
      },
    });
    const session = await prisma.session.create({
      data: {
        pairingId: pairing.id,
        phase: 'ACTIVE_CHAT',
        turnCount: 0,
      },
    });

    await handleVoiceText(session.id, pairing.id, '你好', mockSocket);

    const beforeTts = mockSocket.send.mock.calls.map((call: any) => JSON.parse(call[0]));
    expect(beforeTts.map((m: any) => m.type)).toContain('message:ai_text');
    expect(beforeTts.map((m: any) => m.type)).not.toContain('ai:audio');

    resolveTts({ audioBuffer: Buffer.from('mp3'), audioUrl: '/tts/mock.mp3' });
    await new Promise((r) => setTimeout(r, 50));

    const afterTts = mockSocket.send.mock.calls.map((call: any) => JSON.parse(call[0]));
    const textIndex = afterTts.findIndex((m: any) => m.type === 'message:ai_text');
    const audioIndex = afterTts.findIndex((m: any) => m.type === 'ai:audio');
    expect(textIndex).toBeGreaterThanOrEqual(0);
    expect(audioIndex).toBeGreaterThan(textIndex);

    await prisma.sessionMessage.deleteMany({ where: { sessionId: session.id } });
    await prisma.session.delete({ where: { id: session.id } });
    await prisma.pairing.delete({ where: { id: pairing.id } });
  });

  it('should keep text response when TTS fails', async () => {
    vi.mocked(synthesizeForPairing).mockRejectedValue(new Error('TTS unavailable'));

    const pairing = await prisma.pairing.create({
      data: {
        name: 'Test Pairing TTS Failure',
        inviteCode: `conv-fail-${Date.now()}`,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        participants: {
          create: { name: '测试被陪伴者', role: 'COMPANIONEE' },
        },
      },
    });
    const session = await prisma.session.create({
      data: {
        pairingId: pairing.id,
        phase: 'ACTIVE_CHAT',
        turnCount: 0,
      },
    });

    await handleVoiceText(session.id, pairing.id, '你好', mockSocket);
    await new Promise((r) => setTimeout(r, 50));

    const sentMessages = mockSocket.send.mock.calls.map((call: any) => JSON.parse(call[0]));
    expect(sentMessages.map((m: any) => m.type)).toContain('message:ai_text');
    expect(sentMessages.map((m: any) => m.type)).toContain('ai:audio_unavailable');

    await prisma.sessionMessage.deleteMany({ where: { sessionId: session.id } });
    await prisma.session.delete({ where: { id: session.id } });
    await prisma.pairing.delete({ where: { id: pairing.id } });
  });
});
