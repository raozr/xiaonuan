import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.string().default('3000').transform(Number),
  LOG_LEVEL: z.string().default('info'),
  CORS_ORIGIN: z.string().default('*'),
  JWT_SECRET: z.string().default('xiaonuan-dev-secret'),
  DATABASE_URL: z.string().default('postgresql://xiaonuan:xiaonuan@localhost:5432/xiaonuan'),
  QDRANT_URL: z.string().default('http://localhost:6333'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  WECHAT_APPID: z.string().default(''),
  WECHAT_SECRET: z.string().default(''),
  DASHSCOPE_API_KEY: z.string().default(''),
  NLS_APP_KEY: z.string().default(''),
  NLS_ACCESS_KEY_ID: z.string().default(''),
  NLS_ACCESS_KEY_SECRET: z.string().default(''),
  VOICE_SERVICE_URL: z.string().default('http://localhost:8000'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
