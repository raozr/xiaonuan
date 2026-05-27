import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@xiaonuan/prisma';
import { buildSystemPrompt } from '../agent/prompt-builder.js';
import type { Skill } from '../agent/skill-loader.js';

vi.mock('@xiaonuan/prisma', () => ({
  prisma: {
    participant: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}));

vi.mock('../agent/tone-dictionary.js', () => ({
  getToneAdapter: vi.fn(() => []),
}));

vi.mock('../agent/hidden-goals.js', () => ({
  getHiddenGoal: vi.fn(() => ''),
}));

function mockCompanionee(overrides: Record<string, unknown> = {}) {
  return {
    id: 'elder-1',
    name: '张美丽',
    role: 'COMPANIONEE',
    isAI: false,
    metadata: {},
    ...overrides,
  } as any;
}

function mockSteward(overrides: Record<string, unknown> = {}) {
  return {
    id: 'steward-1',
    name: '高涛',
    role: 'STEWARD',
    isAI: false,
    metadata: {},
    ...overrides,
  } as any;
}

describe('prompt-builder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildSystemPrompt — TONE_AND_PERSONALIZATION 区域', () => {
    it('应包含被陪伴者名字', async () => {
      vi.mocked(prisma.participant.findFirst).mockResolvedValue(mockCompanionee());
      vi.mocked(prisma.participant.findMany).mockResolvedValue([]);

      const result = await buildSystemPrompt('pairing-1', [], {
        time: new Date('2026-05-20T10:00:00Z'),
        turnCount: 1,
        memoryText: '',
      });

      expect(result).toContain('张美丽');
      expect(result).toContain('<TONE_AND_PERSONALIZATION>');
      expect(result).toContain('</TONE_AND_PERSONALIZATION>');
    });

    it('应包含守护人名字和"会经常来看"的描述', async () => {
      vi.mocked(prisma.participant.findFirst).mockResolvedValue(mockCompanionee());
      vi.mocked(prisma.participant.findMany).mockResolvedValue([
        mockSteward({ id: 'steward-1', name: '高涛' }),
      ]);

      const result = await buildSystemPrompt('pairing-1', [], {
        time: new Date('2026-05-20T10:00:00Z'),
        turnCount: 1,
        memoryText: '',
      });

      expect(result).toContain('高涛');
      expect(result).toContain('会经常来看张美丽');
    });
  });

  describe('buildSystemPrompt — 守护人关系前缀', () => {
    it('守护人 metadata 中 relationshipToCompanionee 应作为名字前缀', async () => {
      vi.mocked(prisma.participant.findFirst).mockResolvedValue(mockCompanionee());
      vi.mocked(prisma.participant.findMany).mockResolvedValue([
        mockSteward({ metadata: { relationshipToCompanionee: '侄子' } }),
      ]);

      const result = await buildSystemPrompt('pairing-1', [], {
        time: new Date('2026-05-20T10:00:00Z'),
        turnCount: 1,
        memoryText: '',
      });

      expect(result).toContain('侄子 高涛');
      expect(result).toContain('会经常来看张美丽');
    });

    it('多个守护人各自的关系前缀应正确展示', async () => {
      vi.mocked(prisma.participant.findFirst).mockResolvedValue(mockCompanionee());
      vi.mocked(prisma.participant.findMany).mockResolvedValue([
        mockSteward({ id: 'steward-1', name: '高涛', metadata: { relationshipToCompanionee: '侄子' } }),
        mockSteward({ id: 'steward-2', name: '高芳', metadata: { relationshipToCompanionee: '女儿' } }),
      ]);

      const result = await buildSystemPrompt('pairing-1', [], {
        time: new Date('2026-05-20T10:00:00Z'),
        turnCount: 1,
        memoryText: '',
      });

      expect(result).toContain('侄子 高涛');
      expect(result).toContain('女儿 高芳');
      expect(result).toContain('高涛 会经常来看张美丽');
      expect(result).toContain('高芳 会经常来看张美丽');
    });

    it('没有关系的守护人不显示前缀', async () => {
      vi.mocked(prisma.participant.findFirst).mockResolvedValue(mockCompanionee());
      vi.mocked(prisma.participant.findMany).mockResolvedValue([
        mockSteward(),
      ]);

      const result = await buildSystemPrompt('pairing-1', [], {
        time: new Date('2026-05-20T10:00:00Z'),
        turnCount: 1,
        memoryText: '',
      });

      expect(result).toContain('高涛 会经常来看张美丽');
      expect(result).not.toContain('  高涛');
    });

    it('兼容旧字段 relationships', async () => {
      vi.mocked(prisma.participant.findFirst).mockResolvedValue(mockCompanionee());
      vi.mocked(prisma.participant.findMany).mockResolvedValue([
        mockSteward({ metadata: { relationships: '外甥' } }),
      ]);

      const result = await buildSystemPrompt('pairing-1', [], {
        time: new Date('2026-05-20T10:00:00Z'),
        turnCount: 1,
        memoryText: '',
      });

      expect(result).toContain('外甥 高涛');
    });

    it('relationshipToCompanionee 优先于 relationships', async () => {
      vi.mocked(prisma.participant.findFirst).mockResolvedValue(mockCompanionee());
      vi.mocked(prisma.participant.findMany).mockResolvedValue([
        mockSteward({ metadata: { relationshipToCompanionee: '侄子', relationships: '外甥' } }),
      ]);

      const result = await buildSystemPrompt('pairing-1', [], {
        time: new Date('2026-05-20T10:00:00Z'),
        turnCount: 1,
        memoryText: '',
      });

      expect(result).toContain('侄子 高涛');
      expect(result).not.toContain('外甥 高涛');
    });
  });

  describe('buildSystemPrompt — 守护人 customNotes', () => {
    it('customNotes 应作为额外信息注入', async () => {
      vi.mocked(prisma.participant.findFirst).mockResolvedValue(mockCompanionee());
      vi.mocked(prisma.participant.findMany).mockResolvedValue([
        mockSteward({
          metadata: {
            relationshipToCompanionee: '侄子',
            customNotes: '在外地工作，周末回来看望',
          },
        }),
      ]);

      const result = await buildSystemPrompt('pairing-1', [], {
        time: new Date('2026-05-20T10:00:00Z'),
        turnCount: 1,
        memoryText: '',
      });

      expect(result).toContain('关于 高涛：在外地工作，周末回来看望');
    });
  });

  describe('buildSystemPrompt — 其他个性化配置', () => {
    it('应包含方言偏好', async () => {
      vi.mocked(prisma.participant.findFirst).mockResolvedValue(
        mockCompanionee({ metadata: { dialect: '四川话' } }),
      );
      vi.mocked(prisma.participant.findMany).mockResolvedValue([]);

      const result = await buildSystemPrompt('pairing-1', [], {
        time: new Date('2026-05-20T10:00:00Z'),
        turnCount: 1,
        memoryText: '',
      });

      expect(result).toContain('四川话');
    });

    it('应包含爱好', async () => {
      vi.mocked(prisma.participant.findFirst).mockResolvedValue(
        mockCompanionee({ metadata: { hobbies: '跳广场舞、养花' } }),
      );
      vi.mocked(prisma.participant.findMany).mockResolvedValue([]);

      const result = await buildSystemPrompt('pairing-1', [], {
        time: new Date('2026-05-20T10:00:00Z'),
        turnCount: 1,
        memoryText: '',
      });

      expect(result).toContain('跳广场舞');
    });

    it('应包含健康注意', async () => {
      vi.mocked(prisma.participant.findFirst).mockResolvedValue(
        mockCompanionee({ metadata: { healthNotes: '高血压，按时吃药' } }),
      );
      vi.mocked(prisma.participant.findMany).mockResolvedValue([]);

      const result = await buildSystemPrompt('pairing-1', [], {
        time: new Date('2026-05-20T10:00:00Z'),
        turnCount: 1,
        memoryText: '',
      });

      expect(result).toContain('高血压');
    });

    it('应包含回避话题', async () => {
      vi.mocked(prisma.participant.findFirst).mockResolvedValue(
        mockCompanionee({ metadata: { topicsToAvoid: '去世的丈夫' } }),
      );
      vi.mocked(prisma.participant.findMany).mockResolvedValue([]);

      const result = await buildSystemPrompt('pairing-1', [], {
        time: new Date('2026-05-20T10:00:00Z'),
        turnCount: 1,
        memoryText: '',
      });

      expect(result).toContain('去世的丈夫');
    });

    it('应包含问候偏好', async () => {
      vi.mocked(prisma.participant.findFirst).mockResolvedValue(
        mockCompanionee({ metadata: { greetingPreference: '喜欢被叫"奶奶"' } }),
      );
      vi.mocked(prisma.participant.findMany).mockResolvedValue([]);

      const result = await buildSystemPrompt('pairing-1', [], {
        time: new Date('2026-05-20T10:00:00Z'),
        turnCount: 1,
        memoryText: '',
      });

      expect(result).toContain('喜欢被叫"奶奶"');
    });
  });

  describe('buildSystemPrompt — 技能聚合', () => {
    it('应包含技能内容', async () => {
      vi.mocked(prisma.participant.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.participant.findMany).mockResolvedValue([]);

      const skills: Skill[] = [
        { name: 'greeting', content: '【问候技能】主动问候', description: '', phase: ['greeting'], priority: '1' },
        { name: 'empathy', content: '【共情技能】理解对方情绪', description: '', phase: ['greeting'], priority: '2' },
      ];

      const result = await buildSystemPrompt('pairing-1', skills, {
        time: new Date('2026-05-20T10:00:00Z'),
        turnCount: 1,
        memoryText: '',
      });

      expect(result).toContain('<SKILLS_AGGREGATION>');
      expect(result).toContain('SKILL: greeting');
      expect(result).toContain('SKILL: empathy');
      expect(result).toContain('主动问候');
      expect(result).toContain('理解对方情绪');
    });

    it('没有技能时不应包含 SKILLS_AGGREGATION', async () => {
      vi.mocked(prisma.participant.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.participant.findMany).mockResolvedValue([]);

      const result = await buildSystemPrompt('pairing-1', [], {
        time: new Date('2026-05-20T10:00:00Z'),
        turnCount: 1,
        memoryText: '',
      });

      expect(result).not.toContain('<SKILLS_AGGREGATION>');
    });
  });

  describe('buildSystemPrompt — 结构完整性', () => {
    it('应包含所有核心区域', async () => {
      vi.mocked(prisma.participant.findFirst).mockResolvedValue(mockCompanionee());
      vi.mocked(prisma.participant.findMany).mockResolvedValue([]);

      const result = await buildSystemPrompt('pairing-1', [], {
        time: new Date('2026-05-20T10:00:00Z'),
        turnCount: 1,
        memoryText: '',
      });

      expect(result).toContain('<DIRECTIVE_PRIORITY>');
      expect(result).toContain('<CURRENT_STATE>');
      expect(result).toContain('<TONE_AND_PERSONALIZATION>');
      expect(result).toContain('<ANTI_PATTERNS>');
      expect(result).toContain('<OUTPUT_FORMAT>');
    });

    it('应包含当前时间和轮次', async () => {
      vi.mocked(prisma.participant.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.participant.findMany).mockResolvedValue([]);

      const result = await buildSystemPrompt('pairing-1', [], {
        time: new Date('2026-05-20T10:00:00Z'),
        turnCount: 5,
        memoryText: '',
      });

      expect(result).toContain('current_time: "2026-05-20T10:00:00.000Z"');
      expect(result).toContain('turn_count: 5');
    });

    it('有记忆文本时应包含 current_context', async () => {
      vi.mocked(prisma.participant.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.participant.findMany).mockResolvedValue([]);

      const result = await buildSystemPrompt('pairing-1', [], {
        time: new Date('2026-05-20T10:00:00Z'),
        turnCount: 1,
        memoryText: '【关系档案】\n- [关系] 侄子',
      });

      expect(result).toContain('current_context:');
      expect(result).toContain('【关系档案】');
    });
  });
});
