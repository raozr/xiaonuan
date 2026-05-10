import { describe, it, expect, vi, beforeEach } from 'vitest';
import { memoryContext, memoryRecall } from './memory.js';
import { qdrant } from '../qdrant/client.js';

vi.mock('../qdrant/client.js', () => ({
  qdrant: {
    search: vi.fn(),
  },
}));

vi.mock('@xiaonuan/prisma', () => ({
  prisma: {
    familyFeed: {
      findMany: vi.fn(),
    },
    family: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@xiaonuan/prisma';

describe('memory_context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return recent feeds and elder profile for a family', async () => {
    const familyId = 'family-123';
    const mockFeeds = [
      { id: '1', content: '小明下周回家', type: 'TEXT', createdAt: new Date() },
    ];
    const mockFamily = {
      id: familyId,
      elder: { name: '李爷爷', age: 78 },
    };

    vi.mocked(prisma.familyFeed.findMany).mockResolvedValueOnce(mockFeeds as any);
    vi.mocked(prisma.family.findUnique).mockResolvedValueOnce(mockFamily as any);

    const result = await memoryContext(familyId);

    expect(prisma.familyFeed.findMany).toHaveBeenCalledWith({
      where: { familyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    expect(prisma.family.findUnique).toHaveBeenCalledWith({
      where: { id: familyId },
      include: { elder: true },
    });
    expect(result.feeds).toEqual(mockFeeds);
    expect(result.elder).toEqual(mockFamily.elder);
  });
});

describe('memory_recall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should perform semantic search in Qdrant', async () => {
    const familyId = 'family-123';
    const query = '小明回家';
    const mockResults = [
      {
        id: 'mem-1',
        score: 0.92,
        payload: { content: '小明下周回家', familyId },
      },
    ];

    vi.mocked(qdrant.search).mockResolvedValueOnce(mockResults as any);

    const result = await memoryRecall(query, familyId);

    expect(qdrant.search).toHaveBeenCalled();
    const callArgs = vi.mocked(qdrant.search).mock.calls[0]!;
    expect(callArgs[0]).toBe('family_memories');
    expect(callArgs[1]).toMatchObject({
      limit: 5,
      filter: {
        must: [{ key: 'familyId', match: { value: familyId } }],
      },
    });
    expect(result).toEqual(mockResults);
  });

  it('should include checkpointId filter when provided', async () => {
    const familyId = 'family-123';
    const query = '健康';
    const checkpointId = 'chk-456';

    vi.mocked(qdrant.search).mockResolvedValueOnce([] as any);

    await memoryRecall(query, familyId, checkpointId);

    const callArgs = vi.mocked(qdrant.search).mock.calls[0]!;
    expect(callArgs[1].filter!.must).toContainEqual({
      key: 'checkpointId',
      match: { value: checkpointId },
    });
  });
});
