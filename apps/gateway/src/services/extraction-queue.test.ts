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

import { detectTarget } from './extraction-queue.js';

const baseParticipants = [
  { id: 'elder-1', name: '张美丽', role: 'COMPANIONEE', isAI: false },
  { id: 'steward-1', name: '高涛', role: 'STEWARD', isAI: false },
];

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
      content: '对方说喜欢喝茶',
    });

    expect(job.id).toBe('1');
    expect(job.data).toBeDefined();
    expect(job.data.source).toBe('feed');
    expect(job.data.content).toBe('对方说喜欢喝茶');
    expect(mockAdd).toHaveBeenCalledWith('feed-extraction', {
      source: 'feed',
      pairingId: 'pairing-123',
      content: '对方说喜欢喝茶',
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

describe('extraction-queue detectTarget', () => {
  describe('发送者自己 — 多种亲属关系', () => {
    const cases = [
      { text: '我是她的侄子，小时候是她带我长大的', label: '侄子' },
      { text: '我是他儿子', label: '儿子' },
      { text: '我是她女儿，还没结婚', label: '女儿' },
      { text: '我是她外甥', label: '外甥' },
      { text: '我是她媳妇', label: '媳妇' },
      { text: '我是她女婿', label: '女婿' },
      { text: '我是她老伴', label: '老伴' },
      { text: '我是她朋友', label: '朋友' },
      { text: '我是她同事', label: '同事' },
      { text: '我是她邻居', label: '邻居' },
    ];

    for (const { text, label } of cases) {
      it(`"我是她${label}…" 应识别为"关于发送者自己"`, () => {
        const result = detectTarget(text, 'STEWARD', baseParticipants);
        expect(result.targetDescription).toContain('关于发送者自己');
        expect(result.shouldSkip).toBe(false);
      });
    }
  });

  describe('关于被陪伴者 — 年龄、健康、爱好', () => {
    const cases = [
      { text: '她今年68岁，有两个子女', label: '年龄' },
      { text: '她身体不太好，最近睡眠差', label: '健康' },
      { text: '她最爱跳广场舞', label: '爱好' },
      { text: '她68岁了', label: '年龄(岁)' },
      { text: '她有三个儿子', label: '子女数量' },
      { text: '她喜欢养花', label: '爱好' },
      { text: '她上个月做了手术', label: '健康事件' },
      { text: '她以前是老师', label: '职业' },
      { text: '她最喜欢吃川菜', label: '饮食偏好' },
    ];

    for (const { text, label } of cases) {
      it(`应识别为"关于被陪伴者"（${label}）`, () => {
        const result = detectTarget(text, 'STEWARD', baseParticipants);
        expect(result.targetDescription).toContain('关于被陪伴者');
        expect(result.shouldSkip).toBe(false);
      });
    }
  });

  describe('发送者自己 — 自我介绍类', () => {
    const cases = [
      { text: '我叫小明，在上海上班', label: '我叫' },
      { text: '我从小就跟着奶奶长大', label: '我从小' },
      { text: '我在北京工作', label: '我在+地点' },
      { text: '我叫王芳，是她的学生', label: '我叫+关系' },
    ];

    for (const { text, label } of cases) {
      it(`应识别为"关于发送者自己"（${label}）`, () => {
        const result = detectTarget(text, 'STEWARD', baseParticipants);
        expect(result.targetDescription).toContain('关于发送者自己');
        expect(result.shouldSkip).toBe(false);
      });
    }
  });

  describe('关于被陪伴者 — 事件描述', () => {
    it('"上周她感冒了" 应识别为关于被陪伴者', () => {
      const result = detectTarget('上周她感冒了', 'STEWARD', baseParticipants);
      expect(result.targetDescription).toContain('关于被陪伴者');
    });

    it('"她昨天去体检了" 应识别为关于被陪伴者', () => {
      const result = detectTarget('她昨天去体检了', 'STEWARD', baseParticipants);
      expect(result.targetDescription).toContain('关于被陪伴者');
    });
  });

  describe('默认回退 — 无明确线索时默认关于被陪伴者', () => {
    it('"今天天气不错" 应默认关于被陪伴者', () => {
      const result = detectTarget('今天天气不错', 'STEWARD', baseParticipants);
      expect(result.targetDescription).toContain('关于被陪伴者');
    });

    it('"吃饭了吗" 应默认关于被陪伴者', () => {
      const result = detectTarget('吃饭了吗', 'STEWARD', baseParticipants);
      expect(result.targetDescription).toContain('关于被陪伴者');
    });
  });

  describe('混合场景 — 关系+事实', () => {
    it('"我是她孙女，她今年80岁了" 应识别为关于发送者自己', () => {
      const result = detectTarget('我是她孙女，她今年80岁了', 'STEWARD', baseParticipants);
      expect(result.targetDescription).toContain('关于发送者自己');
    });
  });
});
