import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@xiaonuan/prisma';

vi.mock('@xiaonuan/prisma', () => ({
  prisma: {
    feedMessage: {
      findMany: vi.fn(),
    },
  },
}));

import { getFeedMessages } from './feed-messages.js';

describe('getFeedMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty string when no feeds exist', async () => {
    vi.mocked(prisma.feedMessage.findMany).mockResolvedValue([]);

    const result = await getFeedMessages('pairing-1');
    expect(result).toBe('');
  });

  it('formats recent feed messages with minute time labels', async () => {
    const now = Date.now();
    vi.mocked(prisma.feedMessage.findMany).mockResolvedValue([
      {
        id: '1',
        content: '我们家的地址是北京海淀XX小区',
        type: 'TEXT',
        createdAt: new Date(now - 5 * 60000),
        pairingId: 'pairing-1',
      } as any,
    ]);

    const result = await getFeedMessages('pairing-1');
    expect(result).toContain('【家人留言】');
    expect(result).toContain('5分钟前');
    expect(result).toContain('我们家的地址是北京海淀XX小区');
  });

  it('limits to last 5 feeds', async () => {
    vi.mocked(prisma.feedMessage.findMany).mockResolvedValue([]);

    await getFeedMessages('pairing-1');
    expect(prisma.feedMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 })
    );
  });

  it('truncates overly long content at 200 characters', async () => {
    const longContent = 'x'.repeat(500);
    vi.mocked(prisma.feedMessage.findMany).mockResolvedValue([
      {
        id: '1',
        content: longContent,
        type: 'TEXT',
        createdAt: new Date(),
        pairingId: 'pairing-1',
      } as any,
    ]);

    const result = await getFeedMessages('pairing-1');
    expect(result).toContain('x'.repeat(200) + '…');
    expect(result).not.toContain('x'.repeat(201));
  });

  it('shows hours-ago for messages older than 60 minutes', async () => {
    vi.mocked(prisma.feedMessage.findMany).mockResolvedValue([
      {
        id: '1',
        content: '下周回家吃饭',
        type: 'TEXT',
        createdAt: new Date(Date.now() - 120 * 60000),
        pairingId: 'pairing-1',
      } as any,
    ]);

    const result = await getFeedMessages('pairing-1');
    expect(result).toContain('2小时前');
    expect(result).toContain('下周回家吃饭');
  });
});
