import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFns = vi.hoisted(() => ({
  collectionExists: vi.fn(),
  createCollection: vi.fn(),
  createPayloadIndex: vi.fn(),
}));

vi.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: vi.fn().mockImplementation(() => ({
    collectionExists: mockFns.collectionExists,
    createCollection: mockFns.createCollection,
    createPayloadIndex: mockFns.createPayloadIndex,
  })),
}));

import { ensureFamilyMemoriesCollection } from './client.js';

describe('ensureFamilyMemoriesCollection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create collection when it does not exist', async () => {
    mockFns.collectionExists.mockResolvedValueOnce({ exists: false });
    mockFns.createCollection.mockResolvedValueOnce(undefined);
    mockFns.createPayloadIndex.mockResolvedValueOnce(undefined);

    await ensureFamilyMemoriesCollection();

    expect(mockFns.createCollection).toHaveBeenCalledWith('family_memories', {
      vectors: {
        size: 1024,
        distance: 'Cosine',
      },
    });
  });

  it('should create familyId payload index after collection creation', async () => {
    mockFns.collectionExists.mockResolvedValueOnce({ exists: false });
    mockFns.createCollection.mockResolvedValueOnce(undefined);
    mockFns.createPayloadIndex.mockResolvedValueOnce(undefined);

    await ensureFamilyMemoriesCollection();

    expect(mockFns.createPayloadIndex).toHaveBeenCalledWith('family_memories', {
      field_name: 'familyId',
      field_schema: 'keyword',
    });
  });

  it('should skip creation when collection already exists', async () => {
    mockFns.collectionExists.mockResolvedValueOnce({ exists: true });

    await ensureFamilyMemoriesCollection();

    expect(mockFns.createCollection).not.toHaveBeenCalled();
    expect(mockFns.createPayloadIndex).not.toHaveBeenCalled();
  });

  it('should not throw when qdrant is unreachable', async () => {
    mockFns.collectionExists.mockRejectedValueOnce(new Error('Connection refused'));

    await expect(ensureFamilyMemoriesCollection()).resolves.toBeUndefined();
  });

  it('should log warning when qdrant is unreachable', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFns.collectionExists.mockRejectedValueOnce(new Error('Connection refused'));

    await ensureFamilyMemoriesCollection();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Qdrant]'),
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });
});
