import { QdrantClient } from '@qdrant/js-client-rest';
import { env } from '../config/env.js';

export const qdrant = new QdrantClient({ url: env.QDRANT_URL });

export async function ensureCollection(
  name: string,
  vectorSize: number = 1536
): Promise<void> {
  const { exists } = await qdrant.collectionExists(name);
  if (exists) return;

  await qdrant.createCollection(name, {
    vectors: {
      size: vectorSize,
      distance: 'Cosine',
    },
  });
}

export async function ensurePairingMemoriesCollection(): Promise<void> {
  try {
    const { exists } = await qdrant.collectionExists('pairing_memories');
    if (exists) return;

    await qdrant.createCollection('pairing_memories', {
      vectors: {
        size: 1024,
        distance: 'Cosine',
      },
    });

    await qdrant.createPayloadIndex('pairing_memories', {
      field_name: 'pairingId',
      field_schema: 'keyword',
    });
  } catch (err) {
    console.error('[Qdrant] pairing_memories collection 初始化失败，中短期记忆将暂时不可用:', err);
  }
}
