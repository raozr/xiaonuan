import { loadSkillsForPhase, type Skill } from './skill-loader.js';
import { memoryContext, memoryRecall, memoryNote } from '../tools/memory.js';
import { emergencyAlert } from '../tools/alert.js';
import { chatCompletion } from '../services/dashscope.js';
import { buildSystemPrompt } from './prompt-builder.js';
import { getRecentMessages } from '../conversation/turn-manager.js';
import { buildMemoryContext } from '../memory/context-builder.js';
import { cleanLLMResponse } from './response-cleaner.js';
import { z } from 'zod';
import { performance } from 'perf_hooks';

export interface PiAgentConfig {
  pairingId: string;
  phase: string;
}

export interface ProcessMessageOptions {
  sessionId: string;
  turnCount: number;
}

export interface PiAgent {
  pairingId: string;
  phase: string;
  getSkills(): Skill[];
  getTools(): Record<string, Function>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  processMessage(input: string, options: ProcessMessageOptions): Promise<string>;
}

const toolArgSchemas = {
  memory_context: z.object({}).passthrough(),
  memory_recall: z.object({
    query: z.string().min(1),
    checkpointId: z.string().optional(),
  }).passthrough(),
  memory_note: z.object({
    category: z.string().min(1),
    content: z.string().min(1),
  }).passthrough(),
  emergency_alert: z.object({
    severity: z.enum(['HIGH', 'CRITICAL']),
    reason: z.string().min(1),
  }).passthrough(),
};

function elapsedSince(start: number) {
  return Math.round(performance.now() - start);
}

function shouldUseTools(input: string) {
  const recallPattern = /记得|想起|以前|上次|那次|之前|回忆|喜欢|讨厌|家人|儿子|女儿|老伴|孙|留言|说了什么|医院|疼|痛|吃不下|难受|不舒服|摔|晕|胸闷|喘|自杀|不想活/;
  return recallPattern.test(input);
}

function maxToolTurnsFor(input: string) {
  const urgentPattern = /救命|胸痛|胸闷|喘不上|摔倒|晕倒|自杀|不想活|要死/;
  return urgentPattern.test(input) ? 2 : 1;
}

function parseToolArguments(name: string, raw: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Tool ${name} arguments must be valid JSON`);
  }

  const schema = toolArgSchemas[name as keyof typeof toolArgSchemas];
  if (!schema) return parsed as Record<string, unknown>;

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const message = result.error.errors
      .map((e) => `${e.path.join('.') || 'arguments'}: ${e.message}`)
      .join('; ');
    throw new Error(`Tool ${name} arguments invalid: ${message}`);
  }

  return result.data;
}

export async function createPiAgent(config: PiAgentConfig): Promise<PiAgent> {
  const skills = await loadSkillsForPhase(config.phase);

  const tools: Record<string, Function> = {
    memory_context: async (args: { pairingId: string }) => {
      return memoryContext(args.pairingId);
    },
    memory_recall: async (args: {
      query: string;
      pairingId: string;
      checkpointId?: string;
    }) => {
      return memoryRecall(args.query, args.pairingId, args.checkpointId);
    },
    memory_note: async (args: {
      category: string;
      content: string;
      pairingId: string;
    }) => {
      return memoryNote(args.category, args.content, args.pairingId);
    },
    emergency_alert: async (args: {
      severity: 'HIGH' | 'CRITICAL';
      reason: string;
      pairingId: string;
    }) => {
      return emergencyAlert(args.severity, args.reason, args.pairingId);
    },
  };

  const agentTools = [
    {
      type: 'function',
      function: {
        name: 'memory_recall',
        description:
          "检索对方的历史记忆、偏好或往事。当对方提及特定的人物、事件，或使用模糊的代词（如'那次'）时必须调用。",
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
          '记录新的对方偏好、健康状况或生活事件。只有当对方明确表达了新的事实时才调用。',
        parameters: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: '记忆的分类，例如 hobby, health, preference',
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
        name: 'memory_context',
        description:
          '获取家人最近给您的留言或投喂内容。当对方提到家人最近说了什么、或者您需要了解家人最近传递的任何信息时调用。',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'emergency_alert',
        description:
          '当对方表现出生命威胁、严重的身体不适或极度负面的情绪（自残倾向）时，必须立刻调用此工具。',
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
              description: '触发告警的具体原因或对方的原话',
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
    const totalStart = performance.now();
    const meta = {
      pairingId: config.pairingId,
      sessionId: options.sessionId,
      turnCount: options.turnCount,
    };
    let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    try {
      const historyStart = performance.now();
      history = await getRecentMessages(options.sessionId, 10);
      console.log('[Perf] agent.history', { ...meta, elapsedMs: elapsedSince(historyStart) });
    } catch (err) {
      console.error('[PiAgent] 获取历史消息失败:', err);
    }

    let memoryText = '';
    try {
      const memoryStart = performance.now();
      memoryText = await buildMemoryContext({
        pairingId: config.pairingId,
        turnCount: options.turnCount,
        input,
        phase: config.phase,
      });
      console.log('[Perf] agent.memory_context', {
        ...meta,
        elapsedMs: elapsedSince(memoryStart),
        chars: memoryText.length,
      });
    } catch (err) {
      console.error('[PiAgent] 构建记忆上下文失败:', err);
    }

    const promptStart = performance.now();
    const fullSystemPrompt = await buildSystemPrompt(
      config.pairingId,
      skills,
      {
        time: new Date(),
        turnCount: options.turnCount,
        memoryText,
      }
    );
    console.log('[Perf] agent.prompt', {
      ...meta,
      elapsedMs: elapsedSince(promptStart),
      chars: fullSystemPrompt.length,
    });

    const messages: any[] = [
      { role: 'system', content: fullSystemPrompt },
      ...history,
      { role: 'user', content: input },
    ];
    const enabledTools = shouldUseTools(input) ? agentTools : [];
    const maxToolTurns = maxToolTurnsFor(input);

    try {
      console.log('[PiAgent] LLM input (last user msg):', input);
      const llmStart = performance.now();
      let reply = await chatCompletion(messages, {
        temperature: 0.85,
        maxTokens: 512,
        tools: enabledTools,
      });
      console.log('[Perf] agent.llm.initial', {
        ...meta,
        elapsedMs: elapsedSince(llmStart),
        toolsEnabled: enabledTools.length > 0,
      });
      console.log('[PiAgent] LLM raw reply.content:', JSON.stringify(reply.content));

      // Handle tool calls loop; keep normal turns to one tool round for latency.
      let toolTurns = 0;
      while (reply.tool_calls && reply.tool_calls.length > 0 && toolTurns < maxToolTurns) {
        toolTurns++;
        messages.push({
          role: 'assistant',
          content: reply.content ?? '',
          tool_calls: reply.tool_calls,
        });

        for (const tc of reply.tool_calls) {
          const fnName = tc.function.name;
          let toolResult: string;
          const toolStart = performance.now();
          try {
            const toolFn = tools[fnName];
            if (!toolFn) {
              toolResult = JSON.stringify({ error: `Tool ${fnName} not found` });
            } else {
              const fnArgs = parseToolArguments(fnName, tc.function.arguments);
              const res = await toolFn({ ...fnArgs, pairingId: config.pairingId });
              toolResult = JSON.stringify(res);
            }
          } catch (err: any) {
            toolResult = JSON.stringify({ error: err.message });
          }
          console.log('[Perf] agent.tool_call', {
            ...meta,
            tool: fnName,
            toolTurn: toolTurns,
            elapsedMs: elapsedSince(toolStart),
          });

          messages.push({
            role: 'tool',
            name: fnName,
            content: toolResult,
            tool_call_id: tc.id,
          });
        }

        const llmToolStart = performance.now();
        reply = await chatCompletion(messages, {
          temperature: 0.85,
          maxTokens: 512,
          tools: enabledTools,
        });
        console.log('[Perf] agent.llm.after_tool', {
          ...meta,
          toolTurn: toolTurns,
          elapsedMs: elapsedSince(llmToolStart),
        });
        console.log('[PiAgent] LLM raw reply.content (after tools):', JSON.stringify(reply.content));
      }

      const content = cleanLLMResponse(reply.content ?? '哎呀，我刚才走神了，您再说一遍好吗？');
      console.log('[Perf] agent.total', { ...meta, elapsedMs: elapsedSince(totalStart) });
      console.log('[PiAgent] LLM cleaned content:', content);
      return content;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[PiAgent] LLM 调用失败:', errMsg);
      if (errMsg.includes('超时')) {
        return '哎呀，我刚才走神了，您再说一遍好吗？';
      }
      return '今天网络有点慢，您能再说一遍吗？';
    }
  }

  return {
    pairingId: config.pairingId,
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
