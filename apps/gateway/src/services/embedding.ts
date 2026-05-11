import { env } from '../config/env.js';

const API_KEY = env.DASHSCOPE_API_KEY;
const HTTP_BASE = 'https://dashscope.aliyuncs.com';

export async function embedText(text: string): Promise<number[]> {
  const res = await fetch(`${HTTP_BASE}/compatible-mode/v1/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-v4',
      input: text,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '未知错误');
    throw new Error(`Embedding 请求失败 [${res.status}]: ${errText}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const list = data.data as Array<Record<string, unknown>> | undefined;
  const first = list?.[0];
  const embedding = first?.embedding as number[] | undefined;

  if (!embedding || !Array.isArray(embedding)) {
    throw new Error('Embedding 返回格式异常');
  }

  return embedding;
}
