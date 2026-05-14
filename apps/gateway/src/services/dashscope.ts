import { env } from '../config/env.js';

const API_KEY = env.DASHSCOPE_API_KEY;
const HTTP_BASE = 'https://dashscope.aliyuncs.com';

/* ------------------------------------------------------------------ */
/*  LLM (qwen3.6-plus)  HTTP                                         */
/* ------------------------------------------------------------------ */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface ChatResponse {
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

async function _chatCompletionOnce(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number; tools?: any[] }
): Promise<ChatResponse> {
  const body: Record<string, unknown> = {
    model: 'qwen3.6-plus',
    messages,
    temperature: options?.temperature ?? 0.85,
    max_tokens: options?.maxTokens ?? 1024,
    enable_thinking: false,
  };

  if (options?.tools && options.tools.length > 0) {
    body.tools = options.tools;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(`${HTTP_BASE}/compatible-mode/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => '未知错误');
      throw new Error(`LLM 请求失败 [${res.status}]: ${errText}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    console.log('[Dashscope] LLM raw response:', JSON.stringify(data).slice(0, 2000));
    const choices = data.choices as Array<Record<string, unknown>> | undefined;
    const first = choices?.[0];
    const msg = first?.message as ChatResponse | undefined;

    if (!msg) {
      throw new Error('LLM 返回内容为空');
    }

    return {
      content: msg.content ?? null,
      tool_calls: msg.tool_calls,
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('LLM 请求超时 (60s)');
    }
    throw err;
  }
}

export async function chatCompletion(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number; tools?: any[] }
): Promise<ChatResponse> {
  try {
    return await _chatCompletionOnce(messages, options);
  } catch (err) {
    if (err instanceof Error && err.message.includes('超时')) {
      console.warn('[Dashscope] LLM 超时，尝试重试...');
      return await _chatCompletionOnce(messages, options);
    }
    throw err;
  }
}
