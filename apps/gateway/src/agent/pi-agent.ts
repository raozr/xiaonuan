import { loadSkillsForPhase, type Skill } from './skill-loader.js';
import { memoryContext, memoryRecall } from '../tools/memory.js';

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

  // Mock conversation processor
  async function processMessage(input: string): Promise<string> {
    // TODO: Replace with real LLM integration
    // For now, return a warm placeholder response based on loaded skills
    const personaSkill = skills.find((s) => s.name === 'companion-persona');
    if (personaSkill) {
      return `小暖听到了：「${input}」。我在呢，想多聊聊吗？`;
    }
    return `我在呢，您接着说。`;
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
