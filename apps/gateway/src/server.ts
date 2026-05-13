import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { join } from 'path';
import { env } from './config/env.js';
import { ensureFamilyMemoriesCollection } from './qdrant/client.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { familyRoutes } from './routes/family.js';
import { meRoutes } from './routes/me.js';
import { sessionRoutes } from './routes/session.js';
import { asrRoutes } from './routes/asr.js';
import { ttsRoutes } from './routes/tts.js';
import { authenticate } from './middleware/auth.js';

const app = Fastify({
  logger: {
    level: env.LOG_LEVEL,
  },
});

await app.register(cors, {
  origin: env.CORS_ORIGIN,
  credentials: true,
});

await app.register(jwt, {
  secret: env.JWT_SECRET,
});

await app.register(websocket);

await app.register(healthRoutes, { prefix: '/health' });
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(familyRoutes, { prefix: '/api/family' });
await app.register(sessionRoutes);

await app.register(async (protectedRoutes) => {
  await authenticate(protectedRoutes);
  await meRoutes(protectedRoutes);
}, { prefix: '/api/me' });

await app.register(async (apiRoutes) => {
  await authenticate(apiRoutes);
  await asrRoutes(apiRoutes);
}, { prefix: '/api/asr' });

await app.register(async (apiRoutes) => {
  await authenticate(apiRoutes);
  await ttsRoutes(apiRoutes);
}, { prefix: '/api/tts' });

// Serve static files (tts, feeds)
const staticPlugin = (await import('@fastify/static')).default;
await app.register(staticPlugin, {
  root: join(process.cwd(), 'public'),
  prefix: '/',
});

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await ensureFamilyMemoriesCollection();
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`Gateway listening on http://localhost:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

export { app };
