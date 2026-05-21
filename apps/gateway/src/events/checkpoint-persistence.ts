import { Redis } from 'ioredis';
import { env } from '../config/env.js';

const PENDING_KEY_PREFIX = 'checkpoint:pending:';
const PENDING_TTL = 3600; // 1 hour

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL);
    redis.on('error', (err: Error) => {
      console.error('[CheckpointPersistence] Redis connection error:', err.message);
    });
  }
  return redis;
}

export async function markCheckpointPending(sessionId: string, pairingId: string): Promise<void> {
  const r = getRedis();
  await r.set(`${PENDING_KEY_PREFIX}${sessionId}`, pairingId, 'EX', PENDING_TTL);
}

export async function clearCheckpointPending(sessionId: string): Promise<void> {
  const r = getRedis();
  await r.del(`${PENDING_KEY_PREFIX}${sessionId}`);
}

export async function scanPendingCheckpoints(): Promise<Map<string, string>> {
  const r = getRedis();
  const result = new Map<string, string>();
  let cursor = 0;

  do {
    const [next, keys] = await r.scan(cursor, 'MATCH', `${PENDING_KEY_PREFIX}*`, 'COUNT', 100);
    cursor = parseInt(next, 10);
    for (const key of keys) {
      const sessionId = key.replace(PENDING_KEY_PREFIX, '');
      const pairingId = await r.get(key);
      if (pairingId) {
        result.set(sessionId, pairingId);
      }
    }
  } while (cursor !== 0);

  return result;
}

export async function shutdownCheckpointPersistence(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
