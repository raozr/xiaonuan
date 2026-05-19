import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track mock state at module level so all Queue instances share the same job list
const mockJobs: any[] = [];
const mockAdd = vi.fn().mockImplementation(async (jobName: string, data: any) => {
  const job = { id: String(mockJobs.length + 1), name: jobName, data };
  mockJobs.push(job);
  return job;
});

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation((name: string) => ({
    name,
    add: mockAdd,
    close: vi.fn(),
    getWaiting: vi.fn().mockResolvedValue(mockJobs),
  })),
  Worker: vi.fn().mockImplementation((_name: string, _processor: Function, _opts: any) => ({
    close: vi.fn(),
    on: vi.fn(),
  })),
}));

describe('extraction-queue', () => {
  beforeEach(() => {
    mockJobs.length = 0;
    mockAdd.mockClear();
    vi.resetModules();
  });

  it('should create queue instance', async () => {
    const { getQueue } = await import('../services/extraction-queue.js');
    const q = await getQueue();
    expect(q).toBeDefined();
    expect(q.name).toBe('extraction');
  });

  it('should add a feed extraction job', async () => {
    const { getQueue } = await import('../services/extraction-queue.js');
    const q = await getQueue();
    const job = await q.add('feed-extraction', {
      source: 'feed',
      pairingId: 'pairing-123',
      content: '老人说喜欢喝茶',
    });

    expect(job.id).toBe('1');
    expect(job.data).toBeDefined();
    expect(job.data.source).toBe('feed');
    expect(job.data.content).toBe('老人说喜欢喝茶');
    expect(mockAdd).toHaveBeenCalledWith('feed-extraction', {
      source: 'feed',
      pairingId: 'pairing-123',
      content: '老人说喜欢喝茶',
    });
  });

  it('should add checkpoint job with context', async () => {
    const { getQueue } = await import('../services/extraction-queue.js');
    const q = await getQueue();
    const job = await q.add('checkpoint-extraction', {
      source: 'checkpoint',
      pairingId: 'pairing-456',
      content: '儿子周末回来',
      context: 'Session context',
    });

    expect(job.data).toBeDefined();
    expect(job.data.source).toBe('checkpoint');
    expect(job.data.context).toBe('Session context');
    expect(mockAdd).toHaveBeenCalledWith('checkpoint-extraction', {
      source: 'checkpoint',
      pairingId: 'pairing-456',
      content: '儿子周末回来',
      context: 'Session context',
    });
  });
});
