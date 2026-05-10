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
