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
  PUBLIC_BASE_URL: z.string().optional(),
  ENABLE_EXTRACTION_WORKER: z.string().default('true').transform((value) => value !== 'false'),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV !== 'production') return;

  const required: Array<keyof typeof env> = [
    'DATABASE_URL',
    'QDRANT_URL',
    'REDIS_URL',
    'DASHSCOPE_API_KEY',
    'VOICE_SERVICE_URL',
    'PUBLIC_BASE_URL',
  ];

  for (const key of required) {
    if (!env[key]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is required in production`,
      });
    }
  }

  if (!env.JWT_SECRET || env.JWT_SECRET === 'xiaonuan-dev-secret' || env.JWT_SECRET === 'change-me-in-production') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['JWT_SECRET'],
      message: 'JWT_SECRET must be explicitly configured in production',
    });
  }

  if (env.CORS_ORIGIN === '*') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CORS_ORIGIN'],
      message: 'CORS_ORIGIN must not be "*" in production',
    });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
