import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { createPiAgent } from './pi-agent.js';
import { loadSkillsForPhase } from './skill-loader.js';
import { memoryContext, memoryRecall } from '../tools/memory.js';
import { prisma } from '@xiaonuan/prisma';
import { buildSystemPrompt } from './prompt-builder.js';

vi.mock('./skill-loader.js', () => ({
  loadSkillsForPhase: vi.fn(),
}));

vi.mock('../tools/memory.js', () => ({
  memoryContext: vi.fn(),
  memoryRecall: vi.fn(),
}));

vi.mock('../services/dashscope.js', () => ({
  chatCompletion: vi.fn().mockResolvedValue({ content: '小暖的回复' }),
}));

vi.mock('./prompt-builder.js', () => ({
  buildSystemPrompt: vi.fn().mockResolvedValue('你是小暖，一位温暖、耐心、贴心的老人陪伴助手。'),
}));

vi.mock('../conversation/turn-manager.js', () => ({
  getRecentMessages: vi.fn().mockResolvedValue([]),
}));

vi.mock('../memory/context-builder.js', () => ({
  buildMemoryContext: vi.fn().mockResolvedValue(''),
}));

describe('Pi Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with family context and load skills', async () => {
    vi.mocked(loadSkillsForPhase).mockResolvedValueOnce([
      { name: 'companion-persona', content: '温暖陪伴者', description: '', phase: ['all'], priority: '' },
    ]);

    const agent = await createPiAgent({
      familyId: 'family-123',
      phase: 'ACTIVE_CHAT',
    });

    expect(loadSkillsForPhase).toHaveBeenCalledWith('ACTIVE_CHAT');
    expect(agent.familyId).toBe('family-123');
    expect(agent.phase).toBe('ACTIVE_CHAT');
  });

  it('should load all required skills for active_chat phase', async () => {
    vi.mocked(loadSkillsForPhase).mockResolvedValueOnce([
      { name: 'companion-persona', content: '人设...', description: '', phase: ['all'], priority: '' },
      { name: 'memory-protocol', content: '记忆协议...', description: '', phase: ['active_chat'], priority: '' },
      { name: 'conversation-strategy', content: '对话策略...', description: '', phase: ['active_chat'], priority: '' },
      { name: 'conversation-flow', content: '过渡语言...', description: '', phase: ['active_chat'], priority: '' },
    ]);

    const agent = await createPiAgent({
      familyId: 'family-123',
      phase: 'ACTIVE_CHAT',
    });

    const skills = agent.getSkills();
    const skillNames = skills.map((s) => s.name);
    expect(skillNames).toContain('companion-persona');
    expect(skillNames).toContain('memory-protocol');
    expect(skillNames).toContain('conversation-strategy');
    expect(skillNames).toContain('conversation-flow');
  });

  it('should register memory tools', async () => {
    vi.mocked(loadSkillsForPhase).mockResolvedValueOnce([]);

    const agent = await createPiAgent({
      familyId: 'family-123',
      phase: 'ACTIVE_CHAT',
    });

    const tools = agent.getTools();
    expect(tools).toHaveProperty('memory_context');
    expect(tools).toHaveProperty('memory_recall');
  });

  it('should call memory_context tool when invoked', async () => {
    vi.mocked(loadSkillsForPhase).mockResolvedValueOnce([]);
    vi.mocked(memoryContext).mockResolvedValueOnce({
      feeds: [],
      elder: { name: '李爷爷' } as any,
    });

    const agent = await createPiAgent({
      familyId: 'family-123',
      phase: 'ACTIVE_CHAT',
    });

    const result = await agent.callTool('memory_context', { familyId: 'family-123' }) as any;
    expect(memoryContext).toHaveBeenCalledWith('family-123');
    expect(result.elder.name).toBe('李爷爷');
  });

  it('should call memory_recall tool when invoked', async () => {
    vi.mocked(loadSkillsForPhase).mockResolvedValueOnce([]);
    vi.mocked(memoryRecall).mockResolvedValueOnce([
      { id: '1', score: 0.9, payload: { content: 'test' }, version: 1 } as any,
    ]);

    const agent = await createPiAgent({
      familyId: 'family-123',
      phase: 'ACTIVE_CHAT',
    });

    const result = await agent.callTool('memory_recall', {
      query: 'test',
      familyId: 'family-123',
    }) as any[];
    expect(memoryRecall).toHaveBeenCalledWith('test', 'family-123', undefined);
    expect(result).toHaveLength(1);
  });

  it('should process text input and return text output', async () => {
    vi.mocked(loadSkillsForPhase).mockResolvedValueOnce([
      { name: 'companion-persona', content: '温暖陪伴者', description: '', phase: ['all'], priority: '' },
    ]);

    const agent = await createPiAgent({
      familyId: 'family-123',
      phase: 'ACTIVE_CHAT',
    });

    const response = await agent.processMessage('你好', { sessionId: 'session-123', turnCount: 1 });
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
  });

  it('should handle tool calls and return final text', async () => {
    vi.mocked(loadSkillsForPhase).mockResolvedValueOnce([]);

    const agent = await createPiAgent({
      familyId: 'family-123',
      phase: 'ACTIVE_CHAT',
    });

    const { chatCompletion } = await import('../services/dashscope.js');
    
    // First call returns a tool call
    vi.mocked(chatCompletion).mockResolvedValueOnce({
      content: null,
      tool_calls: [
        {
          id: 'call_1',
          type: 'function',
          function: {
            name: 'memory_note',
            arguments: JSON.stringify({ category: 'HEALTH', content: '胃痛吃不下饭' }),
          },
        },
      ],
    });

    // Second call returns the final text
    vi.mocked(chatCompletion).mockResolvedValueOnce({
      content: '哎哟，这可太受罪了。您先别着急，我去跟孩子说一声。',
    });

    const mockTool = vi.fn().mockResolvedValue({ success: true, feedId: '123' });
    // Override the agent tool locally for testing
    agent.getTools()['memory_note'] = mockTool;

    const response = await agent.processMessage('哎，我这几天胃痛得吃不下肉，太难受了。', { sessionId: 'session-123', turnCount: 1 });

    expect(response).toBe('哎哟，这可太受罪了。您先别着急，我去跟孩子说一声。');
    expect(chatCompletion).toHaveBeenCalledTimes(2);
  });

  it('should include session history in messages array', async () => {
    const { getRecentMessages } = await import('../conversation/turn-manager.js');
    vi.mocked(getRecentMessages).mockResolvedValueOnce([
      { role: 'user' as const, content: '你好吗' },
      { role: 'assistant' as const, content: '我很好' },
    ]);

    vi.mocked(loadSkillsForPhase).mockResolvedValueOnce([]);

    const agent = await createPiAgent({
      familyId: 'family-123',
      phase: 'ACTIVE_CHAT',
    });

    await agent.processMessage('今天天气不错', { sessionId: 'session-123', turnCount: 2 });

    const { chatCompletion } = await import('../services/dashscope.js');
    const messages = vi.mocked(chatCompletion).mock.calls[0]![0];

    expect(messages[0]!.role).toBe('system');
    expect(messages[1]).toEqual({ role: 'user', content: '你好吗' });
    expect(messages[2]).toEqual({ role: 'assistant', content: '我很好' });
    expect(messages[messages.length - 1]).toEqual({ role: 'user', content: '今天天气不错' });
  });

  it('should inject skill content into system prompt', async () => {
    vi.mocked(loadSkillsForPhase).mockResolvedValueOnce([
      { name: 'companion-persona', content: '温暖陪伴者', description: '', phase: ['all'], priority: '' },
      { name: 'conversation-strategy', content: '对话策略...', description: '', phase: ['active_chat'], priority: '' },
    ]);

    const agent = await createPiAgent({
      familyId: 'family-123',
      phase: 'ACTIVE_CHAT',
    });

    await agent.processMessage('你好', { sessionId: 'session-123', turnCount: 1 });

    const { chatCompletion } = await import('../services/dashscope.js');
    const systemMessage = vi.mocked(chatCompletion).mock.calls[0]![0][0];

    expect(systemMessage!.content).toContain('温暖陪伴者');
    expect(systemMessage!.content).toContain('对话策略...');
  });

  it('should inject memory context into system prompt', async () => {
    const { buildMemoryContext } = await import('../memory/context-builder.js');
    vi.mocked(buildMemoryContext).mockResolvedValueOnce('【今日回顾】\n- 上午聊到儿子周末回家。');
    vi.mocked(loadSkillsForPhase).mockResolvedValueOnce([]);

    const agent = await createPiAgent({
      familyId: 'family-123',
      phase: 'ACTIVE_CHAT',
    });

    await agent.processMessage('你好', { sessionId: 'session-123', turnCount: 1 });

    const { chatCompletion } = await import('../services/dashscope.js');
    const systemMessage = vi.mocked(chatCompletion).mock.calls[0]![0][0];

    expect(systemMessage!.content).toContain('【今日回顾】');
    expect(systemMessage!.content).toContain('上午聊到儿子周末回家');
  });
});

describe('buildSystemPrompt', () => {
  let realBuildSystemPrompt: typeof buildSystemPrompt;

  beforeAll(async () => {
    const mod = await vi.importActual<typeof import('./prompt-builder.js')>('./prompt-builder.js');
    realBuildSystemPrompt = mod.buildSystemPrompt;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should include all filled fields in prompt', async () => {
    const family = await prisma.family.create({
      data: {
        inviteCode: `prompt-${Date.now()}`,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        elder: {
          create: {
            name: '王奶奶',
            age: 78,
            dialect: '四川话',
            hobbies: '养花、听京剧',
            healthNotes: '腰不好',
            topicsToAvoid: '已故的老伴',
            greetingPreference: '称呼我老王就行',
          },
        },
        children: {
          create: {
            userId: `c1-${Date.now()}`,
            name: '小李',
            phone: `13900${Date.now()}`.slice(-5),
            relationshipToElder: '儿子',
            customNotes: '我在北京工作',
          },
        },
      },
      include: { elder: true, children: true },
    });

    const prompt = await realBuildSystemPrompt(
      family.id,
      [],
      { time: new Date(), turnCount: 1, memoryText: '' }
    );


    expect(prompt).toContain('王奶奶');
    expect(prompt).toContain('78 岁');
    expect(prompt).toContain('四川话');
    expect(prompt).toContain('养花、听京剧');
    expect(prompt).toContain('腰不好');
    expect(prompt).toContain('已故的老伴');
    expect(prompt).toContain('称呼我老王就行');
    expect(prompt).toContain('儿子');
    expect(prompt).toContain('小李');
    expect(prompt).toContain('我在北京工作');

    await prisma.family.delete({ where: { id: family.id } });
  });

  it('should omit empty fields from prompt', async () => {
    const family = await prisma.family.create({
      data: {
        inviteCode: `prompt2-${Date.now()}`,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        elder: {
          create: {
            name: '张爷爷',
            age: 80,
          },
        },
        children: {
          create: {
            userId: `c2-${Date.now()}`,
            name: '小张',
            phone: `13901${Date.now()}`.slice(-5),
          },
        },
      },
      include: { elder: true, children: true },
    });

    const prompt = await realBuildSystemPrompt(
      family.id,
      [],
      { time: new Date(), turnCount: 1, memoryText: '' }
    );

    expect(prompt).toContain('张爷爷');
    expect(prompt).toContain('80 岁');
    expect(prompt).not.toContain('她喜欢');
    expect(prompt).not.toContain('健康注意');
    expect(prompt).not.toContain('回避话题');
    expect(prompt).not.toContain('问候偏好');

    await prisma.family.delete({ where: { id: family.id } });
  });
});
