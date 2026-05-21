import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Redis } from 'ioredis';
import {
  markCheckpointPending,
  clearCheckpointPending,
  scanPendingCheckpoints,
  shutdownCheckpointPersistence,
} from './checkpoint-persistence.js';

vi.mock('ioredis', () => {
  const store = new Map<string, string>();

  const MockRedis = vi.fn(() => ({
    set: vi.fn(async (key: string, value: string, ...args: unknown[]) => {
      store.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    scan: vi.fn(async (_cursor: number, _match: string, _pattern: string, _count: string) => {
      const keys = Array.from(store.keys());
      return ['0', keys];
    }),
    on: vi.fn(),
    quit: vi.fn(async () => {}),
    _clearStore: () => store.clear(),
  }));

  return { Redis: MockRedis, default: MockRedis };
});

describe('checkpoint-persistence', () => {
  beforeEach(async () => {
    await shutdownCheckpointPersistence();
    // Clear the mock store
    const r = new Redis('redis://localhost') as unknown as { _clearStore: () => void };
    r._clearStore();
  });

  afterEach(async () => {
    await shutdownCheckpointPersistence();
  });

  it('should mark a checkpoint as pending', async () => {
    await markCheckpointPending('session-1', 'pairing-1');

    const r = new Redis('redis://localhost');
    const value = await r.get('checkpoint:pending:session-1');
    expect(value).toBe('pairing-1');
  });

  it('should clear a pending checkpoint', async () => {
    await markCheckpointPending('session-2', 'pairing-2');

    const r = new Redis('redis://localhost');
    expect(await r.get('checkpoint:pending:session-2')).toBe('pairing-2');

    await clearCheckpointPending('session-2');
    expect(await r.get('checkpoint:pending:session-2')).toBeNull();
  });

  it('should scan all pending checkpoints', async () => {
    await markCheckpointPending('session-a', 'pairing-a');
    await markCheckpointPending('session-b', 'pairing-b');

    const pending = await scanPendingCheckpoints();
    expect(pending.get('session-a')).toBe('pairing-a');
    expect(pending.get('session-b')).toBe('pairing-b');
    expect(pending.size).toBe(2);
  });

  it('should return empty map when no pending checkpoints', async () => {
    const pending = await scanPendingCheckpoints();
    expect(pending.size).toBe(0);
  });
});
