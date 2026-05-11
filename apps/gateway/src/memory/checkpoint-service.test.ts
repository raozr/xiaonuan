import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateCheckpoint } from './checkpoint-service.js';

vi.mock('../services/dashscope.js', () => ({
  chatCompletion: vi.fn(),
}));

vi.mock('../services/embedding.js', () => ({
  embedText: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

vi.mock('../qdrant/client.js', () => ({
  qdrant: {
    upsert: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@xiaonuan/prisma', () => ({
  prisma: {
    sessionMessage: {
      findMany: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
    },
    checkpoint: {
      upsert: vi.fn().mockResolvedValue(undefined),
    },
    familyFeed: {
      create: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

import { prisma } from '@xiaonuan/prisma';
import { chatCompletion } from '../services/dashscope.js';
import { embedText } from '../services/embedding.js';
import { qdrant } from '../qdrant/client.js';

describe('checkpoint-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should skip when session has < 2 messages', async () => {
    vi.mocked(prisma.sessionMessage.findMany).mockResolvedValueOnce([
      { id: '1', role: 'ELDER', content: '你好', createdAt: new Date() },
    ] as any);

    await generateCheckpoint('session-123');

    expect(chatCompletion).not.toHaveBeenCalled();
    expect(prisma.checkpoint.upsert).not.toHaveBeenCalled();
  });

  it('should generate checkpoint and write to prisma, qdrant, familyfeed', async () => {
    vi.mocked(prisma.sessionMessage.findMany).mockResolvedValueOnce([
      { id: '1', role: 'ELDER', content: '你好', createdAt: new Date() },
      { id: '2', role: 'AI', content: '您好呀', createdAt: new Date() },
      { id: '3', role: 'ELDER', content: '我儿子周末回来', createdAt: new Date() },
    ] as any);

    vi.mocked(prisma.session.findUnique).mockResolvedValueOnce({
      id: 'session-123',
      familyId: 'family-123',
    } as any);

    vi.mocked(chatCompletion).mockResolvedValueOnce({
      content: JSON.stringify({
        topicSummary: '聊到家人来访',
        keyFacts: [
          { fact: '儿子周末回来', category: 'EVENT' },
          { fact: '老人心情很好', category: 'EVENT' },
        ],
        moodSnapshot: '开心',
        nextTopicHint: '问问老人想吃什么',
      })
    });

    await generateCheckpoint('session-123');

    // Verify Prisma upsert
    expect(prisma.checkpoint.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { checkpointId: 'session-123' },
        update: expect.objectContaining({
          topicSummary: '聊到家人来访',
          keyFacts: ['儿子周末回来', '老人心情很好'],
        }),
        create: expect.objectContaining({
          sessionId: 'session-123',
          checkpointId: 'session-123',
        }),
      })
    );

    // Verify Qdrant upsert
    expect(embedText).toHaveBeenCalled();
    expect(qdrant.upsert).toHaveBeenCalledWith(
      'family_memories',
      expect.objectContaining({
        points: expect.arrayContaining([
          expect.objectContaining({
            id: 'session-123',
            payload: expect.objectContaining({
              familyId: 'family-123',
              type: 'checkpoint',
            }),
          }),
        ]),
      })
    );

    // Verify FamilyFeed creation
    expect(prisma.familyFeed.create).toHaveBeenCalledTimes(2);
  });

  it('should use LLM-provided categories for keyFacts', async () => {
    vi.mocked(prisma.sessionMessage.findMany).mockResolvedValueOnce([
      { id: '1', role: 'ELDER', content: '我腰有点疼', createdAt: new Date() },
      { id: '2', role: 'AI', content: '要多休息', createdAt: new Date() },
    ] as any);

    vi.mocked(prisma.session.findUnique).mockResolvedValueOnce({
      id: 'session-123',
      familyId: 'family-123',
    } as any);

    vi.mocked(chatCompletion).mockResolvedValueOnce({
      content: JSON.stringify({
        topicSummary: '老人腰疼',
        keyFacts: [
          { fact: '腰有点疼', category: 'HEALTH' },
          { fact: '喜欢打太极', category: 'PREFERENCE' },
        ],
        moodSnapshot: '一般',
      })
    });

    await generateCheckpoint('session-123');

    const feedCalls = vi.mocked(prisma.familyFeed.create).mock.calls;
    expect(feedCalls.some((call) =>
      call[0].data.content === '腰有点疼' && call[0].data.category === 'HEALTH'
    )).toBe(true);
    expect(feedCalls.some((call) =>
      call[0].data.content === '喜欢打太极' && call[0].data.category === 'PREFERENCE'
    )).toBe(true);
  });

  it('should fallback to EVENT for invalid category', async () => {
    vi.mocked(prisma.sessionMessage.findMany).mockResolvedValueOnce([
      { id: '1', role: 'ELDER', content: '你好', createdAt: new Date() },
      { id: '2', role: 'AI', content: '您好', createdAt: new Date() },
    ] as any);

    vi.mocked(prisma.session.findUnique).mockResolvedValueOnce({
      id: 'session-123',
      familyId: 'family-123',
    } as any);

    vi.mocked(chatCompletion).mockResolvedValueOnce({
      content: JSON.stringify({
        topicSummary: '日常问候',
        keyFacts: [
          { fact: '天气不错', category: 'HOBBY' },
        ],
        moodSnapshot: '开心',
      })
    });

    await generateCheckpoint('session-123');

    const feedCalls = vi.mocked(prisma.familyFeed.create).mock.calls;
    expect(feedCalls.some((call) =>
      call[0].data.content === '天气不错' && call[0].data.category === 'EVENT'
    )).toBe(true);
  });

  it('should handle LLM JSON parse failure gracefully', async () => {
    vi.mocked(prisma.sessionMessage.findMany).mockResolvedValueOnce([
      { id: '1', role: 'ELDER', content: '你好', createdAt: new Date() },
      { id: '2', role: 'AI', content: '您好', createdAt: new Date() },
    ] as any);

    vi.mocked(chatCompletion).mockResolvedValueOnce({ content: 'invalid json' });

    await expect(generateCheckpoint('session-123')).resolves.toBeUndefined();
    expect(prisma.checkpoint.upsert).not.toHaveBeenCalled();
  });
});
