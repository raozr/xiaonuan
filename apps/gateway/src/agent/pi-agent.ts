import { loadSkillsForPhase, type Skill } from './skill-loader.js';
import { memoryContext, memoryRecall } from '../tools/memory.js';
import { chatCompletion } from '../services/dashscope.js';
import { buildSystemPrompt } from './prompt-builder.js';

export interface PiAgentConfig {
  familyId: string;
  phase: string;
}

export interface PiAgent {
  familyId: string;
  phase: string;
  getSkills(): Skill[];
  getTools(): Record<string, Function>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  processMessage(input: string): Promise<string>;
}

export async function createPiAgent(config: PiAgentConfig): Promise<PiAgent> {
  const skills = await loadSkillsForPhase(config.phase);
  const systemPrompt = await buildSystemPrompt(config.familyId);

  const tools: Record<string, Function> = {
    memory_context: async (args: { familyId: string }) => {
      return memoryContext(args.familyId);
    },
    memory_recall: async (args: {
      query: string;
      familyId: string;
      checkpointId?: string;
    }) => {
      return memoryRecall(args.query, args.familyId, args.checkpointId);
    },
  };

  async function processMessage(input: string): Promise<string> {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: input },
    ];

    try {
      const reply = await chatCompletion(messages, { temperature: 0.85, maxTokens: 512 });
      return reply;
    } catch (err) {
      console.error('[PiAgent] LLM 调用失败:', err);
      return '小暖刚才没听清，您能再说一遍吗？';
    }
  }

  return {
    familyId: config.familyId,
    phase: config.phase,
    getSkills: () => skills,
    getTools: () => tools,
    callTool: async (name: string, args: Record<string, unknown>) => {
      const tool = tools[name];
      if (!tool) throw new Error(`Tool ${name} not found`);
      return tool(args);
    },
    processMessage,
  };
}
