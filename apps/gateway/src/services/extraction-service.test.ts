import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/extraction-queue.js', () => ({
  getQueue: vi.fn().mockResolvedValue({
    add: vi.fn().mockResolvedValue({ id: 'job-123' }),
    close: vi.fn(),
  }),
  shutdownWorker: vi.fn(),
}));

describe('extraction-service', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should enqueue extraction', async () => {
    const { enqueueExtraction } = await import('../services/extraction-service.js');
    const jobId = await enqueueExtraction('feed', 'pairing-123', 'test content');
    expect(jobId).toBe('job-123');
  });
});
