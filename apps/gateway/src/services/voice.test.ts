import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveVoiceId } from './voice.js';

vi.mock('@xiaonuan/prisma', () => ({
  prisma: {
    voiceClone: {
      findFirst: vi.fn(),
    },
    participant: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from '@xiaonuan/prisma';

describe('resolveVoiceId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return active cloned voice when READY', async () => {
    vi.mocked(prisma.voiceClone.findFirst).mockResolvedValueOnce({
      voiceId: 'clone-123',
    } as any);

    const result = await resolveVoiceId('pairing-1');
    expect(result).toBe('clone-123');
    expect(prisma.voiceClone.findFirst).toHaveBeenCalledWith({
      where: { pairingId: 'pairing-1', status: 'READY' },
      select: { voiceId: true },
    });
  });

  it('should return male default voice when no cloned voice and male elder', async () => {
    vi.mocked(prisma.voiceClone.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.participant.findFirst).mockResolvedValueOnce({
      metadata: { gender: 'MALE' },
    } as any);

    const result = await resolveVoiceId('pairing-1');
    expect(result).toBe('longanyang');
  });

  it('should return female default voice when no cloned voice and female elder', async () => {
    vi.mocked(prisma.voiceClone.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.participant.findFirst).mockResolvedValueOnce({
      metadata: { gender: 'FEMALE' },
    } as any);

    const result = await resolveVoiceId('pairing-1');
    expect(result).toBe('longanhuan');
  });

  it('should fallback to female default when gender is unknown', async () => {
    vi.mocked(prisma.voiceClone.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.participant.findFirst).mockResolvedValueOnce(null);

    const result = await resolveVoiceId('pairing-1');
    expect(result).toBe('longanhuan');
  });
});
