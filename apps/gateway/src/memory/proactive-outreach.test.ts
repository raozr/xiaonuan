import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prisma } from '@xiaonuan/prisma';
import {
  findInactivePairings,
  shouldSendOutreach,
  generateOutreachMessage,
  sendOutreach,
} from './proactive-outreach.js';

vi.mock('@xiaonuan/prisma', () => ({
  prisma: {
    pairing: { findMany: vi.fn() },
    session: { findFirst: vi.fn() },
    eventStream: { findFirst: vi.fn() },
    participant: { findFirst: vi.fn() },
    aIPersona: { findUnique: vi.fn() },
  },
}));

vi.mock('../conversation/turn-manager.js', () => ({
  getRecentMessages: () => Promise.resolve([]),
}));

vi.mock('../agent/prompt-builder.js', () => ({
  buildSystemPrompt: () => Promise.resolve('test prompt'),
}));

vi.mock('../services/dashscope.js', () => ({
  chatCompletion: () => Promise.resolve({ content: '您好，最近好吗？小暖想您了。' }),
}));

vi.mock('../agent/response-cleaner.js', () => ({
  cleanLLMResponse: vi.fn((text: string) => text),
}));

vi.mock('../events/event-bus.js', () => ({
  emitEvent: vi.fn().mockResolvedValue(undefined),
}));

import { emitEvent } from '../events/event-bus.js';

describe('proactive-outreach', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('findInactivePairings', () => {
    it('should return pairings with no sessions', async () => {
      vi.mocked(prisma.pairing.findMany).mockResolvedValue([
        { id: 'pairing-1' },
        { id: 'pairing-2' },
      ] as any);
      vi.mocked(prisma.session.findFirst).mockResolvedValue(null);

      const result = await findInactivePairings();
      expect(result).toContain('pairing-1');
      expect(result).toContain('pairing-2');
    });

    it('should return pairings with old sessions', async () => {
      vi.mocked(prisma.pairing.findMany).mockResolvedValue([
        { id: 'pairing-1' },
      ] as any);
      vi.mocked(prisma.session.findFirst).mockResolvedValue({
        updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      } as any);

      const result = await findInactivePairings();
      expect(result).toContain('pairing-1');
    });

    it('should exclude pairings with recent sessions', async () => {
      vi.mocked(prisma.pairing.findMany).mockResolvedValue([
        { id: 'pairing-1' },
      ] as any);
      vi.mocked(prisma.session.findFirst).mockResolvedValue({
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      } as any);

      const result = await findInactivePairings();
      expect(result).not.toContain('pairing-1');
    });
  });

  describe('shouldSendOutreach', () => {
    it('should return true when no previous outreach', async () => {
      vi.mocked(prisma.eventStream.findFirst).mockResolvedValue(null);

      const result = await shouldSendOutreach('pairing-1');
      expect(result).toBe(true);
    });

    it('should return false when last outreach was within 24 hours', async () => {
      vi.mocked(prisma.eventStream.findFirst).mockResolvedValue({
        eventTime: new Date(Date.now() - 12 * 60 * 60 * 1000),
      } as any);

      const result = await shouldSendOutreach('pairing-1');
      expect(result).toBe(false);
    });

    it('should return true when last outreach was over 24 hours ago', async () => {
      vi.mocked(prisma.eventStream.findFirst).mockResolvedValue({
        eventTime: new Date(Date.now() - 30 * 60 * 60 * 1000),
      } as any);

      const result = await shouldSendOutreach('pairing-1');
      expect(result).toBe(true);
    });
  });

  describe('generateOutreachMessage', () => {
    it('should return null when elder not found', async () => {
      vi.mocked(prisma.participant.findFirst).mockResolvedValue(null);

      const result = await generateOutreachMessage('pairing-1');
      expect(result).toBeNull();
    });

    it('should call chatCompletion with correct prompt', async () => {
      vi.mocked(prisma.participant.findFirst).mockResolvedValue({
        id: 'companionee-1',
        name: '测试被陪伴者',
      } as any);
      vi.mocked(prisma.session.findFirst).mockResolvedValue({ id: 'session-1' } as any);

      const result = await generateOutreachMessage('pairing-1');
      expect(result).toBe('您好，最近好吗？小暖想您了。');
    });
  });

  describe('sendOutreach', () => {
    it('should skip when cooldown not met', async () => {
      vi.mocked(prisma.eventStream.findFirst).mockResolvedValue({
        eventTime: new Date(Date.now() - 12 * 60 * 60 * 1000),
      } as any);

      const result = await sendOutreach('pairing-1');
      expect(result).toBe(false);
      expect(vi.mocked(emitEvent)).not.toHaveBeenCalled();
    });

    it('should send and record outreach when cooldown met', async () => {
      vi.mocked(prisma.eventStream.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.participant.findFirst).mockResolvedValue({
        id: 'companionee-1',
        name: '测试被陪伴者',
      } as any);
      vi.mocked(prisma.session.findFirst).mockResolvedValue(null);

      const result = await sendOutreach('pairing-1');
      expect(result).toBe(true);
      expect(vi.mocked(emitEvent)).toHaveBeenCalledWith(
        expect.objectContaining({
          pairingId: 'pairing-1',
          type: 'proactive_outreach',
          content: '您好，最近好吗？小暖想您了。',
        }),
        { immediate: true },
      );
    });
  });
});
