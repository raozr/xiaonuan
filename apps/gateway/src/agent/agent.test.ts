import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPiAgent } from './pi-agent.js';
import { loadSkillsForPhase } from './skill-loader.js';
import { memoryContext, memoryRecall } from '../tools/memory.js';

vi.mock('./skill-loader.js', () => ({
  loadSkillsForPhase: vi.fn(),
}));

vi.mock('../tools/memory.js', () => ({
  memoryContext: vi.fn(),
  memoryRecall: vi.fn(),
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

    const response = await agent.processMessage('你好');
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
  });
});
