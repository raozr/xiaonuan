import { describe, it, expect, vi, beforeEach } from 'vitest';
import { memoryContext, memoryRecall } from './memory.js';
import { qdrant } from '../qdrant/client.js';

vi.mock('../qdrant/client.js', () => ({
  qdrant: {
    search: vi.fn(),
  },
}));

vi.mock('../services/embedding.js', () => ({
  embedText: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

vi.mock('@xiaonuan/prisma', () => ({
  prisma: {
    feedMessage: {
      findMany: vi.fn(),
    },
    participant: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from '@xiaonuan/prisma';

describe('memory_context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return recent feeds and elder participant for a pairing', async () => {
    const pairingId = 'pairing-123';
    const mockFeeds = [
      { id: '1', content: '小明下周回家', type: 'TEXT', createdAt: new Date() },
    ];
    const mockElder = { id: 'p-1', name: '李爷爷', role: 'ELDER' };

    vi.mocked(prisma.feedMessage.findMany).mockResolvedValueOnce(mockFeeds as any);
    vi.mocked(prisma.participant.findFirst).mockResolvedValueOnce(mockElder as any);

    const result = await memoryContext(pairingId);

    expect(prisma.feedMessage.findMany).toHaveBeenCalledWith({
      where: { pairingId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    expect(prisma.participant.findFirst).toHaveBeenCalledWith({
      where: { pairingId, role: 'ELDER', isAI: false },
    });
    expect(result.feeds).toEqual(mockFeeds);
    expect(result.elder).toEqual(mockElder);
  });
});

describe('memory_recall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should perform semantic search in Qdrant pairing_memories', async () => {
    const pairingId = 'pairing-123';
    const query = '小明回家';
    const mockResults = [
      {
        id: 'mem-1',
        score: 0.92,
        payload: { content: '小明下周回家', pairingId },
      },
    ];

    vi.mocked(qdrant.search).mockResolvedValueOnce(mockResults as any);

    const result = await memoryRecall(query, pairingId);

    expect(qdrant.search).toHaveBeenCalled();
    const callArgs = vi.mocked(qdrant.search).mock.calls[0]!;
    expect(callArgs[0]).toBe('pairing_memories');
    expect(callArgs[1]).toMatchObject({
      limit: 5,
      filter: {
        must: [{ key: 'pairingId', match: { value: pairingId } }],
      },
    });
    expect(result).toEqual(mockResults);
  });

  it('should include checkpointId filter when provided', async () => {
    const pairingId = 'pairing-123';
    const query = '健康';
    const checkpointId = 'chk-456';

    vi.mocked(qdrant.search).mockResolvedValueOnce([] as any);

    await memoryRecall(query, pairingId, checkpointId);

    const callArgs = vi.mocked(qdrant.search).mock.calls[0]!;
    expect(callArgs[1].filter!.must).toContainEqual({
      key: 'checkpointId',
      match: { value: checkpointId },
    });
  });
});
