import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@xiaonuan/prisma';
import { getTopProfiles, getProfilesByCategories, addProfiles } from './persona-service.js';

vi.mock('@xiaonuan/prisma', () => ({
  prisma: {
    personaProfile: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

describe('persona-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTopProfiles', () => {
    it('should query by pairingId ordered by confidence desc', async () => {
      vi.mocked(prisma.personaProfile.findMany).mockResolvedValue([
        { id: '1', category: 'health', content: '血糖高', confidence: 0.9 },
        { id: '2', category: 'hobby', content: '喜欢钓鱼', confidence: 0.7 },
      ] as any);

      const profiles = await getTopProfiles('pairing-123', 2);
      expect(profiles).toHaveLength(2);
      expect(prisma.personaProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { pairingId: 'pairing-123' },
          orderBy: [{ confidence: 'desc' }, { updatedAt: 'desc' }],
          take: 2,
        })
      );
    });

    it('should use default limit of 5', async () => {
      vi.mocked(prisma.personaProfile.findMany).mockResolvedValue([]);

      await getTopProfiles('pairing-123');
      expect(prisma.personaProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      );
    });
  });

  describe('getProfilesByCategories', () => {
    it('should filter by categories and order by createdAt desc', async () => {
      vi.mocked(prisma.personaProfile.findMany).mockResolvedValue([]);

      await getProfilesByCategories('pairing-123', ['health', 'preference'], 3);
      expect(prisma.personaProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { pairingId: 'pairing-123', category: { in: ['health', 'preference'] } },
          orderBy: { createdAt: 'desc' },
          take: 3,
        })
      );
    });
  });

  describe('addProfiles', () => {
    it('should return 0 when no profiles provided', async () => {
      const count = await addProfiles('pairing-123', 'companionee-1', []);
      expect(count).toBe(0);
      expect(prisma.personaProfile.createMany).not.toHaveBeenCalled();
    });

    it('should create profiles with correct pairingId and participantId', async () => {
      vi.mocked(prisma.personaProfile.createMany).mockResolvedValue({ count: 2 } as any);

      const count = await addProfiles('pairing-123', 'companionee-1', [
        { category: 'hobby', content: '喜欢钓鱼', confidence: 0.9 },
        { category: 'health', content: '血糖高', confidence: 0.8, source: 'feed' },
      ]);

      expect(count).toBe(2);
      expect(prisma.personaProfile.createMany).toHaveBeenCalledWith({
        data: [
          { pairingId: 'pairing-123', participantId: 'companionee-1', category: 'hobby', content: '喜欢钓鱼', confidence: 0.9, source: null },
          { pairingId: 'pairing-123', participantId: 'companionee-1', category: 'health', content: '血糖高', confidence: 0.8, source: 'feed' },
        ],
      });
    });
  });
});
