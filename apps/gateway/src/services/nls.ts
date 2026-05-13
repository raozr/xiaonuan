import { env } from '../config/env.js';
import RPCClient from '@alicloud/pop-core';

const TTS_URL = 'https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/tts';
const ASR_URL = 'https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr';

interface NlsToken {
  id: string;
  expireTime: number;
}

let cachedToken: NlsToken | null = null;

async function fetchToken(): Promise<NlsToken> {
  if (!env.NLS_ACCESS_KEY_ID || !env.NLS_ACCESS_KEY_SECRET) {
    throw new Error('NLS AccessKey 未配置');
  }

  const client = new RPCClient({
    accessKeyId: env.NLS_ACCESS_KEY_ID,
    accessKeySecret: env.NLS_ACCESS_KEY_SECRET,
    endpoint: 'http://nls-meta.cn-shanghai.aliyuncs.com',
    apiVersion: '2019-02-28',
  });

  const result = (await client.request('CreateToken', {})) as Record<string, unknown>;
  const token = result.Token as Record<string, unknown> | undefined;
  const id = token?.Id as string | undefined;
  const expireTime = token?.ExpireTime as number | undefined;

  if (!id || !expireTime) {
    throw new Error('NLS Token 响应格式异常');
  }

  return { id, expireTime };
}

async function getToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  // Token 提前 60 秒刷新
  if (!cachedToken || cachedToken.expireTime - now < 60) {
    cachedToken = await fetchToken();
  }
  return cachedToken.id;
}

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  if (!env.NLS_APP_KEY) {
    throw new Error('NLS AppKey 未配置');
  }

  const token = await getToken();

  const res = await fetch(TTS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-NLS-Token': token,
    },
    body: JSON.stringify({
      appkey: env.NLS_APP_KEY,
      token,
      text,
      format: 'mp3',
      sample_rate: 16000,
      voice: 'xiaoyun',
      volume: 50,
      speech_rate: 0,
      pitch_rate: 0,
    }),
  });

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('audio')) {
    return Buffer.from(await res.arrayBuffer());
  }

  const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  throw new Error(`TTS 失败 [${res.status}]: ${err.message || '未知错误'}`);
}

export async function recognizeSpeech(audioBuffer: Buffer, format: string, sampleRate: number): Promise<string> {
  if (!env.NLS_APP_KEY) {
    throw new Error('NLS AppKey 未配置');
  }

  const token = await getToken();
  const query = new URLSearchParams({
    appkey: env.NLS_APP_KEY,
    format: ['wav', 'pcm', 'm4a', 'mp3', 'opus'].includes(format) ? format : 'pcm',
    sample_rate: String(sampleRate),
  });

  const res = await fetch(`${ASR_URL}?${query.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-NLS-Token': token,
    },
    body: audioBuffer,
  });

  const data = (await res.json()) as Record<string, unknown>;
  const status = data.status as number | undefined;
  const result = data.result as string | undefined;

  if (status === 20000000) {
    return result ?? '';
  }

  throw new Error(`ASR 失败 [${status}]: ${data.message || '未知错误'}`);
}
