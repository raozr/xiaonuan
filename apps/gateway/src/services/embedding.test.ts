import { describe, it, expect, vi, beforeEach } from 'vitest';
import { embedText } from './embedding.js';

describe('embedText', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return embedding array from DashScope response', async () => {
    const mockVector = [0.1, 0.2, 0.3, 0.4];
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        object: 'list',
        data: [{ object: 'embedding', embedding: mockVector, index: 0 }],
        model: 'text-embedding-v4',
        usage: { total_tokens: 10 },
      }),
    } as unknown as Response);

    const result = await embedText('测试文本');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(mockVector);

    const fetchCall = vi.mocked(global.fetch).mock.calls[0]!;
    expect(fetchCall[0]).toContain('/embeddings');
    const body = JSON.parse((fetchCall[1] as RequestInit).body as string);
    expect(body.model).toBe('text-embedding-v4');
    expect(body.input).toBe('测试文本');
  });

  it('should throw on HTTP error', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      text: async () => 'rate limit exceeded',
    } as unknown as Response);

    await expect(embedText('测试')).rejects.toThrow('Embedding 请求失败');
  });

  it('should throw on malformed response', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    } as unknown as Response);

    await expect(embedText('测试')).rejects.toThrow('Embedding 返回格式异常');
  });
});
