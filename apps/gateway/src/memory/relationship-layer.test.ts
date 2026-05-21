import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRelationshipLayer } from './relationship-layer.js';
import * as personaService from './persona-service.js';
import * as emotionTracker from './emotion-tracker.js';

vi.mock('./persona-service.js', () => ({
  getTopProfiles: vi.fn(),
}));

vi.mock('./emotion-tracker.js', () => ({
  getCurrentMood: vi.fn(),
}));

function mockProfile(overrides: { id: string; category: string; content: string; confidence: number }) {
  return {
    ...overrides,
    pairingId: 'pairing-1',
    participantId: 'participant-1',
    source: null as string | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('relationship-layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRelationshipLayer — 关系档案优先保留', () => {
    it('关系类别的 profile 应优先保留，不被普通 profile 挤出', async () => {
      vi.mocked(personaService.getTopProfiles).mockResolvedValue([
        mockProfile({ id: '1', category: 'relationship', content: '是被陪伴者的侄子', confidence: 0.6 }),
        mockProfile({ id: '2', category: 'hobby', content: '喜欢跳广场舞', confidence: 0.9 }),
        mockProfile({ id: '3', category: 'health', content: '血糖偏高', confidence: 0.85 }),
        mockProfile({ id: '4', category: 'preference', content: '爱吃辣', confidence: 0.8 }),
        mockProfile({ id: '5', category: 'habit', content: '每天早起', confidence: 0.75 }),
      ]);
      vi.mocked(emotionTracker.getCurrentMood).mockResolvedValue('心情不错');

      const result = await getRelationshipLayer('pairing-1');
      expect(result).toContain('【关系档案】');
      expect(result).toContain('是被陪伴者的侄子');
      expect(result).toContain('喜欢跳广场舞');
    });

    it('关系 profile 不超过3个', async () => {
      vi.mocked(personaService.getTopProfiles).mockResolvedValue([
        mockProfile({ id: '1', category: 'relationship', content: '关系A', confidence: 0.9 }),
        mockProfile({ id: '2', category: 'relationship', content: '关系B', confidence: 0.8 }),
        mockProfile({ id: '3', category: 'relationship', content: '关系C', confidence: 0.7 }),
        mockProfile({ id: '4', category: 'relationship', content: '关系D', confidence: 0.6 }),
        mockProfile({ id: '5', category: 'hobby', content: '爱好', confidence: 0.5 }),
      ]);
      vi.mocked(emotionTracker.getCurrentMood).mockResolvedValue(null);

      const result = await getRelationshipLayer('pairing-1');
      expect(result).toContain('关系A');
      expect(result).toContain('关系B');
      expect(result).toContain('关系C');
      expect(result).not.toContain('关系D');
    });

    it('没有关系 profile 时，使用普通 profile 填充', async () => {
      vi.mocked(personaService.getTopProfiles).mockResolvedValue([
        mockProfile({ id: '1', category: 'hobby', content: '喜欢钓鱼', confidence: 0.9 }),
        mockProfile({ id: '2', category: 'health', content: '血压高', confidence: 0.8 }),
        mockProfile({ id: '3', category: 'preference', content: '不吃香菜', confidence: 0.7 }),
      ]);
      vi.mocked(emotionTracker.getCurrentMood).mockResolvedValue(null);

      const result = await getRelationshipLayer('pairing-1');
      expect(result).toContain('喜欢钓鱼');
      expect(result).toContain('血压高');
    });
  });

  describe('getRelationshipLayer — 情绪展示', () => {
    it('有情绪时展示情绪行', async () => {
      vi.mocked(personaService.getTopProfiles).mockResolvedValue([]);
      vi.mocked(emotionTracker.getCurrentMood).mockResolvedValue('焦虑');

      const result = await getRelationshipLayer('pairing-1');
      expect(result).toContain('焦虑');
      expect(result).toContain('[情绪]');
    });

    it('无情绪时不展示情绪行', async () => {
      vi.mocked(personaService.getTopProfiles).mockResolvedValue([]);
      vi.mocked(emotionTracker.getCurrentMood).mockResolvedValue(null);

      const result = await getRelationshipLayer('pairing-1');
      expect(result).toBe('');
    });
  });

  describe('getRelationshipLayer — 边界情况', () => {
    it('无 profile 无情绪时返回空字符串', async () => {
      vi.mocked(personaService.getTopProfiles).mockResolvedValue([]);
      vi.mocked(emotionTracker.getCurrentMood).mockResolvedValue(null);

      const result = await getRelationshipLayer('pairing-1');
      expect(result).toBe('');
    });

    it('只有情绪无 profile 时只返回情绪行', async () => {
      vi.mocked(personaService.getTopProfiles).mockResolvedValue([]);
      vi.mocked(emotionTracker.getCurrentMood).mockResolvedValue('开心');

      const result = await getRelationshipLayer('pairing-1');
      expect(result).toContain('【关系档案】');
      expect(result).toContain('[情绪] 开心');
    });

    it('大量 profile 时总数不超过5个', async () => {
      vi.mocked(personaService.getTopProfiles).mockResolvedValue([
        mockProfile({ id: '1', category: 'hobby', content: '爱好1', confidence: 0.95 }),
        mockProfile({ id: '2', category: 'hobby', content: '爱好2', confidence: 0.94 }),
        mockProfile({ id: '3', category: 'health', content: '健康1', confidence: 0.93 }),
        mockProfile({ id: '4', category: 'health', content: '健康2', confidence: 0.92 }),
        mockProfile({ id: '5', category: 'preference', content: '偏好1', confidence: 0.91 }),
        mockProfile({ id: '6', category: 'preference', content: '偏好2', confidence: 0.90 }),
        mockProfile({ id: '7', category: 'habit', content: '习惯1', confidence: 0.89 }),
        mockProfile({ id: '8', category: 'habit', content: '习惯2', confidence: 0.88 }),
        mockProfile({ id: '9', category: 'event', content: '事件1', confidence: 0.87 }),
        mockProfile({ id: '10', category: 'event', content: '事件2', confidence: 0.86 }),
        mockProfile({ id: '11', category: 'relationship', content: '关系1', confidence: 0.5 }),
      ]);
      vi.mocked(emotionTracker.getCurrentMood).mockResolvedValue(null);

      const result = await getRelationshipLayer('pairing-1');
      expect(result).toContain('关系1');
      const bulletLines = result.split('\n').filter(l => l.startsWith('- '));
      expect(bulletLines.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getRelationshipLayer — top-10 cutoff bug', () => {
    it('如果10+个非关系 profile 置信度更高，关系 profile 会被 getTopProfiles 截断丢失', async () => {
      vi.mocked(personaService.getTopProfiles).mockResolvedValue([
        mockProfile({ id: '1', category: 'hobby', content: '爱好1', confidence: 0.99 }),
        mockProfile({ id: '2', category: 'hobby', content: '爱好2', confidence: 0.98 }),
        mockProfile({ id: '3', category: 'health', content: '健康1', confidence: 0.97 }),
        mockProfile({ id: '4', category: 'health', content: '健康2', confidence: 0.96 }),
        mockProfile({ id: '5', category: 'preference', content: '偏好1', confidence: 0.95 }),
        mockProfile({ id: '6', category: 'preference', content: '偏好2', confidence: 0.94 }),
        mockProfile({ id: '7', category: 'habit', content: '习惯1', confidence: 0.93 }),
        mockProfile({ id: '8', category: 'habit', content: '习惯2', confidence: 0.92 }),
        mockProfile({ id: '9', category: 'event', content: '事件1', confidence: 0.91 }),
        mockProfile({ id: '10', category: 'event', content: '事件2', confidence: 0.90 }),
      ]);
      vi.mocked(emotionTracker.getCurrentMood).mockResolvedValue(null);

      const result = await getRelationshipLayer('pairing-1');
      expect(result).not.toContain('relationship');
      const bulletLines = result.split('\n').filter(l => l.startsWith('- [关系]'));
      expect(bulletLines.length).toBe(0);
    });
  });

  describe('类别标签映射', () => {
    it('各类别应正确显示中文标签', async () => {
      vi.mocked(personaService.getTopProfiles).mockResolvedValue([
        mockProfile({ id: '1', category: 'hobby', content: '钓鱼', confidence: 0.9 }),
        mockProfile({ id: '2', category: 'health', content: '高血压', confidence: 0.8 }),
        mockProfile({ id: '3', category: 'preference', content: '不吃辣', confidence: 0.7 }),
        mockProfile({ id: '4', category: 'habit', content: '早起', confidence: 0.6 }),
        mockProfile({ id: '5', category: 'relationship', content: '是她侄子', confidence: 0.5 }),
      ]);
      vi.mocked(emotionTracker.getCurrentMood).mockResolvedValue(null);

      const result = await getRelationshipLayer('pairing-1');
      expect(result).toContain('[爱好]');
      expect(result).toContain('[健康]');
      expect(result).toContain('[偏好]');
      expect(result).toContain('[习惯]');
      expect(result).toContain('[关系]');
    });

    it('未知类别使用原始类别名', async () => {
      vi.mocked(personaService.getTopProfiles).mockResolvedValue([
        mockProfile({ id: '1', category: 'unknown_cat', content: '测试', confidence: 0.9 }),
      ]);
      vi.mocked(emotionTracker.getCurrentMood).mockResolvedValue(null);

      const result = await getRelationshipLayer('pairing-1');
      expect(result).toContain('[unknown_cat]');
    });
  });
});
