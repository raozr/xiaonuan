import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveVoiceId } from './voice.js';

vi.mock('@xiaonuan/prisma', () => ({
  prisma: {
    family: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@xiaonuan/prisma';

describe('resolveVoiceId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return cloned voice id when family has one', async () => {
    vi.mocked(prisma.family.findUnique).mockResolvedValueOnce({
      clonedVoiceId: 'clone-123',
      elder: { gender: 'FEMALE' },
    } as any);

    const result = await resolveVoiceId('family-1');
    expect(result).toBe('clone-123');
  });

  it('should return male default voice for male elder', async () => {
    vi.mocked(prisma.family.findUnique).mockResolvedValueOnce({
      clonedVoiceId: null,
      elder: { gender: 'MALE' },
    } as any);

    const result = await resolveVoiceId('family-1');
    expect(result).toBe('longanyang');
  });

  it('should return female default voice for female elder', async () => {
    vi.mocked(prisma.family.findUnique).mockResolvedValueOnce({
      clonedVoiceId: null,
      elder: { gender: 'FEMALE' },
    } as any);

    const result = await resolveVoiceId('family-1');
    expect(result).toBe('longanhuan');
  });

  it('should fallback to female default when gender is unknown', async () => {
    vi.mocked(prisma.family.findUnique).mockResolvedValueOnce({
      clonedVoiceId: null,
      elder: null,
    } as any);

    const result = await resolveVoiceId('family-1');
    expect(result).toBe('longanhuan');
  });
});
