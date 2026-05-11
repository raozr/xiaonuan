import { loadSkillsForPhase, type Skill } from './skill-loader.js';
import { memoryContext, memoryRecall, memoryNote } from '../tools/memory.js';
import { emergencyAlert } from '../tools/alert.js';
import { chatCompletion } from '../services/dashscope.js';
import { buildSystemPrompt } from './prompt-builder.js';
import { getRecentMessages } from '../conversation/turn-manager.js';
import { buildMemoryContext } from '../memory/context-builder.js';

export interface PiAgentConfig {
  familyId: string;
  phase: string;
}

export interface ProcessMessageOptions {
  sessionId: string;
  turnCount: number;
}

export interface PiAgent {
  familyId: string;
  phase: string;
  getSkills(): Skill[];
  getTools(): Record<string, Function>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  processMessage(input: string, options: ProcessMessageOptions): Promise<string>;
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
    memory_note: async (args: {
      category: 'PREFERENCE' | 'HEALTH' | 'EVENT' | 'PERSON' | 'PLACE';
      content: string;
      familyId: string;
    }) => {
      return memoryNote(args.category, args.content, args.familyId);
    },
    emergency_alert: async (args: {
      severity: 'HIGH' | 'CRITICAL';
      reason: string;
      familyId: string;
    }) => {
      return emergencyAlert(args.severity, args.reason, args.familyId);
    },
  };

  const agentTools = [
    {
      type: 'function',
      function: {
        name: 'memory_recall',
        description:
          "检索老人的历史记忆、偏好或往事。当老人提及特定的人物、事件，或使用模糊的代词（如'那次'）时必须调用。",
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: "需要检索的关键信息，例如'喜欢的食物'、'李阿姨'",
            },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'memory_note',
        description:
          '记录新的老人偏好、健康状况或生活事件。只有当老人明确表达了新的事实时才调用。',
        parameters: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: ['PREFERENCE', 'HEALTH', 'EVENT', 'PERSON', 'PLACE'],
              description: '记忆的分类',
            },
            content: {
              type: 'string',
              description:
                "提取的记忆内容，必须是客观事实陈述，例如'不再喜欢吃辣'、'昨天去医院复查了血压'",
            },
          },
          required: ['category', 'content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'emergency_alert',
        description:
          '当老人表现出生命威胁、严重的身体不适或极度负面的情绪（自残倾向）时，必须立刻调用此工具。',
        parameters: {
          type: 'object',
          properties: {
            severity: {
              type: 'string',
              enum: ['HIGH', 'CRITICAL'],
              description: '严重程度',
            },
            reason: {
              type: 'string',
              description: '触发告警的具体原因或老人的原话',
            },
          },
          required: ['severity', 'reason'],
        },
      },
    },
  ];

  async function processMessage(
    input: string,
    options: ProcessMessageOptions
  ): Promise<string> {
    let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    try {
      history = await getRecentMessages(options.sessionId, 10);
    } catch (err) {
      console.error('[PiAgent] 获取历史消息失败:', err);
    }

    let memoryText = '';
    try {
      memoryText = await buildMemoryContext({
        familyId: config.familyId,
        turnCount: options.turnCount,
        input,
        phase: config.phase,
      });
    } catch (err) {
      console.error('[PiAgent] 构建记忆上下文失败:', err);
    }

    const fullSystemPrompt = await buildSystemPrompt(
      config.familyId,
      skills,
      {
        time: new Date(),
        turnCount: options.turnCount,
        memoryText,
      }
    );

    const messages: any[] = [
      { role: 'system', content: fullSystemPrompt },
      ...history,
      { role: 'user', content: input },
    ];

    try {
      let reply = await chatCompletion(messages, {
        temperature: 0.85,
        maxTokens: 512,
        tools: agentTools,
      });

      // Handle tool calls loop (up to 3 turns)
      let toolTurns = 0;
      while (reply.tool_calls && reply.tool_calls.length > 0 && toolTurns < 3) {
        toolTurns++;
        messages.push({
          role: 'assistant',
          content: reply.content ?? '',
          tool_calls: reply.tool_calls,
        });

        for (const tc of reply.tool_calls) {
          const fnName = tc.function.name;
          const fnArgs = JSON.parse(tc.function.arguments);
          let toolResult: string;
          try {
            const toolFn = tools[fnName];
            if (!toolFn) {
              toolResult = JSON.stringify({ error: `Tool ${fnName} not found` });
            } else {
              const res = await toolFn({ ...fnArgs, familyId: config.familyId });
              toolResult = JSON.stringify(res);
            }
          } catch (err: any) {
            toolResult = JSON.stringify({ error: err.message });
          }

          messages.push({
            role: 'tool',
            name: fnName,
            content: toolResult,
            tool_call_id: tc.id,
          });
        }

        reply = await chatCompletion(messages, {
          temperature: 0.85,
          maxTokens: 512,
          tools: agentTools,
        });
      }

      let content = reply.content ?? '小暖刚才没听清，您能再说一遍吗？';
      const responseMatch = content.match(/<response>([\s\S]*?)<\/response>/i);
      if (responseMatch && responseMatch[1]) {
        content = responseMatch[1].trim();
      }
      return content;
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
