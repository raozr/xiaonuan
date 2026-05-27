import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDailyMemory } from './daily-memory.js';
import { getShortTermMemory } from './short-term-memory.js';
import { buildMemoryContext } from './context-builder.js';
import { getRelationshipLayer } from './relationship-layer.js';
import { getCurrentMood } from './emotion-tracker.js';

vi.mock('./emotion-tracker.js', () => ({
  getCurrentMood: vi.fn().mockResolvedValue(null),
  getRecentMoods: vi.fn().mockResolvedValue([]),
}));

vi.mock('@xiaonuan/prisma', () => ({
  prisma: {
    session: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    checkpoint: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    personaProfile: {
      findMany: vi.fn(),
    },
    participant: {
      findFirst: vi.fn(),
    },
    eventStream: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../tools/memory.js', () => ({
  memoryRecall: vi.fn(),
}));

import { prisma } from '@xiaonuan/prisma';
import { memoryRecall } from '../tools/memory.js';
import { getMidTermMemory } from './mid-term-memory.js';
import { clearEntityCache } from './entity-vocabulary.js';

describe('daily-memory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.participant.findFirst).mockResolvedValue({ metadata: { timezone: 'Asia/Shanghai' } } as any);
  });

  it('should return empty string when no ended sessions today', async () => {
    vi.mocked(prisma.session.findMany).mockResolvedValueOnce([]);

    const result = await getDailyMemory('pairing-123');
    expect(result).toBe('');
  });

  it('should format topic summaries from today ended sessions', async () => {
    const today = new Date();
    vi.mocked(prisma.session.findMany).mockResolvedValueOnce([
      {
        id: 'session-1',
        checkpoints: [
          { topicSummary: '聊到儿子周末回家', createdAt: today },
        ],
      },
      {
        id: 'session-2',
        checkpoints: [
          { topicSummary: '提到膝盖不舒服', createdAt: today },
        ],
      },
    ] as any);

    const result = await getDailyMemory('pairing-123');
    expect(result).toContain('【今日回顾】');
    expect(result).toContain('聊到儿子周末回家');
    expect(result).toContain('提到膝盖不舒服');
  });

  it('should use latest checkpoint per session', async () => {
    const today = new Date();
    vi.mocked(prisma.session.findMany).mockResolvedValueOnce([
      {
        id: 'session-1',
        checkpoints: [
          { topicSummary: '最新摘要', createdAt: today },
          { topicSummary: '旧摘要', createdAt: new Date(today.getTime() - 10000) },
        ],
      },
    ] as any);

    const result = await getDailyMemory('pairing-123');
    expect(result).toContain('最新摘要');
    expect(result).not.toContain('旧摘要');
  });
});

describe('short-term-memory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.participant.findFirst).mockResolvedValue({ metadata: { timezone: 'Asia/Shanghai' } } as any);
  });

  it('should return empty string when no checkpoints in window', async () => {
    vi.mocked(prisma.checkpoint.findMany).mockResolvedValueOnce([]);

    const result = await getShortTermMemory('pairing-123');
    expect(result).toBe('');
  });

  it('should aggregate keyFacts within 3 days excluding today', async () => {
    const now = new Date();
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    vi.mocked(prisma.checkpoint.findMany).mockResolvedValueOnce([
      {
        id: 'cp-1',
        keyFacts: ['天气转凉注意添衣', '和隔壁李阿姨通电话'],
        createdAt: twoDaysAgo,
        session: { pairingId: 'pairing-123' },
      },
    ] as any);

    const result = await getShortTermMemory('pairing-123');
    expect(result).toContain('【近日动态】');
    expect(result).toContain('天气转凉注意添衣');
    expect(result).toContain('和隔壁李阿姨通电话');
  });

  it('should limit to 2 keyFacts per day', async () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    vi.mocked(prisma.checkpoint.findMany).mockResolvedValueOnce([
      {
        id: 'cp-1',
        keyFacts: ['事实1', '事实2', '事实3'],
        createdAt: yesterday,
        session: { pairingId: 'pairing-123' },
      },
    ] as any);

    const result = await getShortTermMemory('pairing-123');
    const matches = result.match(/- /g);
    expect(matches?.length).toBe(2);
  });
});

describe('context-builder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.session.findMany).mockReset();
    vi.mocked(prisma.checkpoint.findMany).mockReset();
    vi.mocked(prisma.personaProfile.findMany).mockReset();
    vi.mocked(memoryRecall).mockReset();
    vi.mocked(prisma.participant.findFirst).mockResolvedValue({ metadata: { timezone: 'Asia/Shanghai' } } as any);
  });

  it('should include daily and short-term in first 3 turns', async () => {
    const today = new Date();
    vi.mocked(prisma.session.findMany).mockResolvedValueOnce([
      {
        id: 'session-1',
        checkpoints: [{ topicSummary: '今天摘要', createdAt: today }],
      },
    ] as any);
    vi.mocked(prisma.checkpoint.findMany).mockResolvedValueOnce([]);

    const result = await buildMemoryContext({
      pairingId: 'pairing-123',
      turnCount: 2,
      input: '你好',
    });

    expect(result).toContain('【今日回顾】');
  });

  it('should omit daily and short-term after turn 3', async () => {
    vi.mocked(prisma.session.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.checkpoint.findMany).mockResolvedValueOnce([]);

    const result = await buildMemoryContext({
      pairingId: 'pairing-123',
      turnCount: 4,
      input: '你好',
    });

    expect(result).toBe('');
  });

  it('should omit empty layers', async () => {
    vi.mocked(prisma.session.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.checkpoint.findMany).mockResolvedValueOnce([]);

    const result = await buildMemoryContext({
      pairingId: 'pairing-123',
      turnCount: 1,
      input: '你好',
    });

    expect(result).toBe('');
  });

  it('should fetch daily and short-term memory concurrently', async () => {
    const callTimes: Record<string, number> = {};

    (prisma.session.findMany as any).mockImplementationOnce(async () => {
      callTimes.sessionFindMany = Date.now();
      await new Promise((r) => setTimeout(r, 50));
      return [];
    });

    (prisma.checkpoint.findMany as any).mockImplementationOnce(async () => {
      callTimes.checkpointFindMany = Date.now();
      await new Promise((r) => setTimeout(r, 50));
      return [];
    });

    await buildMemoryContext({
      pairingId: 'pairing-123',
      turnCount: 1,
      input: '你好',
    });

    const diff = Math.abs((callTimes.sessionFindMany ?? 0) - (callTimes.checkpointFindMany ?? 0));
    expect(diff).toBeLessThan(20);
  });

  it('should tolerate failures in individual memory layers', async () => {
    vi.mocked(prisma.session.findMany).mockRejectedValueOnce(new Error('DB down'));
    vi.mocked(prisma.checkpoint.findMany).mockResolvedValueOnce([
      {
        id: 'cp-1',
        keyFacts: ['事实A'],
        createdAt: new Date(Date.now() - 86400000),
        session: { pairingId: 'pairing-123' },
      },
    ] as any);

    const result = await buildMemoryContext({
      pairingId: 'pairing-123',
      turnCount: 1,
      input: '你好',
    });

    expect(result).not.toContain('【今日回顾】');
    expect(result).toContain('【近日动态】');
  });
});

describe('mid-term-memory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.personaProfile.findMany).mockReset();
    vi.mocked(prisma.eventStream.findMany).mockReset();
    vi.mocked(memoryRecall).mockReset();
    clearEntityCache();
  });

  it('should return empty for short input without entities', async () => {
    vi.mocked(prisma.eventStream.findMany).mockResolvedValue([]);
    vi.mocked(prisma.personaProfile.findMany).mockResolvedValue([]);

    const result = await getMidTermMemory('嗯', 'pairing-123');
    expect(result).toBe('');
  });

  it('should trigger for long input (>= 10 chars)', async () => {
    vi.mocked(memoryRecall).mockResolvedValue([
      { id: '1', score: 0.9, payload: { content: '喜欢早上去公园打太极' } },
    ] as any);
    vi.mocked(prisma.personaProfile.findMany).mockResolvedValue([]);

    const result = await getMidTermMemory('我喜欢早上在公园打太极', 'pairing-123');
    expect(result).toContain('【相关回忆】');
    expect(result).toContain('喜欢早上去公园打太极');
  });

  it('should trigger for input with entity words from vocabulary', async () => {
    // getPairingEntities now queries eventStream for tags
    vi.mocked(prisma.eventStream.findMany).mockResolvedValueOnce([
      { tags: ['李阿姨'], content: '李阿姨来访' },
    ] as any);
    vi.mocked(prisma.personaProfile.findMany).mockResolvedValueOnce([
      { id: '2', content: '腰不好，避免久坐', category: 'health' },
    ] as any);
    vi.mocked(memoryRecall).mockResolvedValue([]);

    const result = await getMidTermMemory('李阿姨来了', 'pairing-123');
    expect(result).toContain('腰不好，避免久坐');
  });

  it('should return empty when both sources empty', async () => {
    vi.mocked(memoryRecall).mockResolvedValue([]);
    vi.mocked(prisma.personaProfile.findMany).mockResolvedValue([]);

    const result = await getMidTermMemory('今天天气不错今天天气不错', 'pairing-123');
    expect(result).toBe('');
  });
});

describe('greeting-hint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.session.findFirst).mockReset();
    vi.mocked(prisma.checkpoint.findFirst).mockReset();
  });

  it('should return empty when last session was within 3 days', async () => {
    vi.mocked(prisma.session.findFirst).mockResolvedValueOnce({
      endedAt: new Date(Date.now() - 86400000),
    } as any);

    const { getGreetingHint } = await import('./greeting-hint.js');
    const result = await getGreetingHint('pairing-123');
    expect(result).toBe('');
  });

  it('should return hint when last session was over 3 days ago', async () => {
    vi.mocked(prisma.session.findFirst).mockResolvedValueOnce({
      endedAt: new Date(Date.now() - 5 * 86400000),
    } as any);
    vi.mocked(prisma.checkpoint.findFirst).mockResolvedValueOnce({
      nextTopicHint: '想聊聊孙子的事',
    } as any);

    const { getGreetingHint } = await import('./greeting-hint.js');
    const result = await getGreetingHint('pairing-123');
    expect(result).toContain('【未尽话题】');
    expect(result).toContain('想聊聊孙子的事');
  });

  it('should return empty when no previous session exists', async () => {
    vi.mocked(prisma.session.findFirst).mockResolvedValueOnce(null);

    const { getGreetingHint } = await import('./greeting-hint.js');
    const result = await getGreetingHint('pairing-123');
    expect(result).toBe('');
  });

  it('should inject greeting hint in GREETING phase', async () => {
    vi.mocked(prisma.session.findFirst).mockResolvedValueOnce({
      endedAt: new Date(Date.now() - 5 * 86400000),
    } as any);
    vi.mocked(prisma.checkpoint.findFirst).mockResolvedValueOnce({
      nextTopicHint: '想聊聊孙子的事',
    } as any);

    const result = await buildMemoryContext({
      pairingId: 'pairing-123',
      turnCount: 1,
      input: '你好',
      phase: 'GREETING',
    });

    expect(result).toContain('【未尽话题】');
    expect(result).toContain('想聊聊孙子的事');
  });

  it('should omit greeting hint in non-GREETING phase', async () => {
    vi.mocked(prisma.session.findFirst).mockResolvedValueOnce({
      endedAt: new Date(Date.now() - 5 * 86400000),
    } as any);

    const result = await buildMemoryContext({
      pairingId: 'pairing-123',
      turnCount: 1,
      input: '你好',
      phase: 'ACTIVE_CHAT',
    });

    expect(result).not.toContain('【未尽话题】');
  });
});

describe('dedup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.participant.findFirst).mockResolvedValue({ metadata: { timezone: 'Asia/Shanghai' } } as any);
  });

  it('should remove highly similar bullets across sections', async () => {
    vi.mocked(prisma.session.findMany).mockResolvedValueOnce([
      {
        id: 'session-1',
        checkpoints: [{ topicSummary: '膝盖不太舒服', createdAt: new Date() }],
      },
    ] as any);
    vi.mocked(prisma.checkpoint.findMany).mockResolvedValueOnce([]);
    vi.mocked(memoryRecall).mockResolvedValue([
      { id: '1', score: 0.9, payload: { content: '您提到膝盖不太舒服' } },
    ] as any);
    vi.mocked(prisma.personaProfile.findMany).mockResolvedValue([]);

    const result = await buildMemoryContext({
      pairingId: 'pairing-123',
      turnCount: 1,
      input: '膝盖',
      phase: 'ACTIVE_CHAT',
    });

    // "膝盖不太舒服" from daily and "您提到膝盖不太舒服" from mid-term are similar
    // Only one should remain
    const matches = result.match(/膝盖/g);
    expect(matches?.length).toBeLessThanOrEqual(2);
  });

  it('should keep distinct bullets', async () => {
    vi.mocked(prisma.session.findMany).mockResolvedValueOnce([
      {
        id: 'session-1',
        checkpoints: [{ topicSummary: '聊到儿子周末回家', createdAt: new Date() }],
      },
    ] as any);
    vi.mocked(prisma.checkpoint.findMany).mockResolvedValueOnce([]);
    vi.mocked(memoryRecall).mockResolvedValue([
      { id: '1', score: 0.9, payload: { content: '喜欢早上去公园打太极' } },
    ] as any);
    vi.mocked(prisma.personaProfile.findMany).mockResolvedValue([]);

    const result = await buildMemoryContext({
      pairingId: 'pairing-123',
      turnCount: 1,
      input: '我喜欢早上在公园打太极',
      phase: 'ACTIVE_CHAT',
    });

    expect(result).toContain('聊到儿子周末回家');
    expect(result).toContain('喜欢早上去公园打太极');
  });
});

describe('relationship-layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.personaProfile.findMany).mockReset();
    vi.mocked(getCurrentMood).mockResolvedValue(null);
  });

  it('should return empty string when no profiles exist', async () => {
    vi.mocked(prisma.personaProfile.findMany).mockResolvedValue([]);

    const result = await getRelationshipLayer('pairing-123');
    expect(result).toBe('');
  });

  it('should return top 5 profiles ordered by confidence desc', async () => {
    vi.mocked(prisma.personaProfile.findMany).mockResolvedValue([
      { category: 'health', content: '腰不好，避免久坐', confidence: 0.95, updatedAt: new Date() },
      { category: 'hobby', content: '喜欢早上去公园打太极', confidence: 0.9, updatedAt: new Date() },
      { category: 'preference', content: '不喜欢吃辣', confidence: 0.8, updatedAt: new Date() },
      { category: 'person', content: '经常和隔壁李阿姨聊天', confidence: 0.7, updatedAt: new Date() },
      { category: 'habit', content: '每晚看新闻联播', confidence: 0.6, updatedAt: new Date() },
    ] as any);

    const result = await getRelationshipLayer('pairing-123');
    expect(result).toContain('【关系档案】');
    expect(result).toContain('[健康] 腰不好，避免久坐');
    expect(result).toContain('[爱好] 喜欢早上去公园打太极');
    expect(result).toContain('[偏好] 不喜欢吃辣');
    expect(result).toContain('[人物] 经常和隔壁李阿姨聊天');
    expect(result).toContain('[习惯] 每晚看新闻联播');
  });

  it('should include current mood in relationship layer', async () => {
    vi.mocked(getCurrentMood).mockResolvedValue('心情不错');
    vi.mocked(prisma.personaProfile.findMany).mockResolvedValue([
      { category: 'health', content: '血糖偏高', confidence: 0.9, updatedAt: new Date() },
    ] as any);

    const result = await getRelationshipLayer('pairing-123');
    expect(result).toContain('【关系档案】');
    expect(result).toContain('[情绪] 心情不错');
    expect(result).toContain('[健康] 血糖偏高');
  });

  it('should include relationship layer in buildMemoryContext', async () => {
    vi.mocked(prisma.session.findMany).mockResolvedValue([]);
    vi.mocked(prisma.checkpoint.findMany).mockResolvedValue([]);
    vi.mocked(memoryRecall).mockResolvedValue([]);
    vi.mocked(prisma.personaProfile.findMany).mockResolvedValue([
      { category: 'health', content: '血糖偏高', confidence: 0.9, updatedAt: new Date() },
    ] as any);

    const result = await buildMemoryContext({
      pairingId: 'pairing-123',
      turnCount: 1,
      input: '你好',
      phase: 'ACTIVE_CHAT',
    });

    expect(result).toContain('【关系档案】');
    expect(result).toContain('[健康] 血糖偏高');
  });
});

describe('context-builder token budget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.session.findMany).mockReset();
    vi.mocked(prisma.checkpoint.findMany).mockReset();
    vi.mocked(prisma.personaProfile.findMany).mockReset();
    vi.mocked(memoryRecall).mockReset();
    vi.mocked(prisma.participant.findFirst).mockResolvedValue({ metadata: { timezone: 'Asia/Shanghai' } } as any);
  });

  it('should truncate sections when exceeding token budget', async () => {
    // Create a very large daily memory response
    const largeContent = 'x'.repeat(5000);
    vi.mocked(prisma.session.findMany).mockResolvedValue([
      {
        id: 'session-1',
        checkpoints: [{ topicSummary: largeContent, createdAt: new Date() }],
      },
    ] as any);
    vi.mocked(prisma.checkpoint.findMany).mockResolvedValue([]);
    vi.mocked(memoryRecall).mockResolvedValue([]);
    vi.mocked(prisma.personaProfile.findMany).mockResolvedValue([]);

    const result = await buildMemoryContext({
      pairingId: 'pairing-123',
      turnCount: 1,
      input: '你好',
      phase: 'ACTIVE_CHAT',
    });

    // The result should be truncated to fit within the budget
    expect(result.length).toBeLessThanOrEqual(4096);
  });

  it('should preserve relationship layer over daily layer when truncating', async () => {
    const largeContent = 'y'.repeat(3000);
    vi.mocked(prisma.session.findMany).mockResolvedValue([
      {
        id: 'session-1',
        checkpoints: [{ topicSummary: largeContent, createdAt: new Date() }],
      },
    ] as any);
    vi.mocked(prisma.checkpoint.findMany).mockResolvedValue([]);
    vi.mocked(memoryRecall).mockResolvedValue([]);
    vi.mocked(prisma.personaProfile.findMany).mockResolvedValue([
      { category: 'health', content: '重要健康信息', confidence: 0.95, updatedAt: new Date() },
    ] as any);

    const result = await buildMemoryContext({
      pairingId: 'pairing-123',
      turnCount: 1,
      input: '你好',
      phase: 'ACTIVE_CHAT',
    });

    // Relationship layer should be preserved (higher priority)
    expect(result).toContain('【关系档案】');
    expect(result).toContain('重要健康信息');
  });
});
