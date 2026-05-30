import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { join } from 'path';
import { env } from './config/env.js';
import { ensurePairingMemoriesCollection } from './qdrant/client.js';
import { startWorker } from './services/extraction-queue.js';
import { pruneEvents } from './events/event-archiver.js';
import { runProactiveOutreach } from './memory/proactive-outreach.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { pcAuthRoutes } from './routes/pc-auth.js';
import { pairingRoutes } from './routes/pairing.js';
import { eventsRoutes } from './routes/events.js';
import { meRoutes } from './routes/me.js';
import { sessionRoutes } from './routes/session.js';
import { asrRoutes } from './routes/asr.js';
import { ttsRoutes } from './routes/tts.js';
import { voiceCloneRoutes } from './routes/voice-clone.js';
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

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  return reply.status(500).send({
    success: false,
    message: '服务器繁忙，请稍后再试',
  });
});

await app.register(jwt, {
  secret: env.JWT_SECRET,
});

await app.register(websocket, {
  errorHandler: (error, socket, request) => {
    request.log.error(error);
    if (socket.readyState === 1) {
      socket.close(1011, 'Internal server error');
    }
  }
});

await app.register(healthRoutes, { prefix: '/health' });
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(pcAuthRoutes, { prefix: '/api/pc-auth' });
await app.register(pairingRoutes, { prefix: '/api/pairings' });
await app.register(eventsRoutes, { prefix: '/api/pairings' });
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

await app.register(async (apiRoutes) => {
  await authenticate(apiRoutes);
  await voiceCloneRoutes(apiRoutes);
}, { prefix: '/api/voice-clone' });

// Serve static files (tts, feeds)
const staticPlugin = (await import('@fastify/static')).default;
await app.register(staticPlugin, {
  root: join(process.cwd(), 'public'),
  prefix: '/',
});

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await ensurePairingMemoriesCollection();
    if (env.ENABLE_EXTRACTION_WORKER) {
      await startWorker();
      app.log.info('Extraction worker started');
    } else {
      app.log.info('Extraction worker disabled by ENABLE_EXTRACTION_WORKER=false');
    }

    // Daily event pruning at 2:00 AM
    function schedulePruning() {
      const now = new Date();
      const next = new Date(now);
      next.setHours(2, 0, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      const ms = next.getTime() - now.getTime();
      const timer = setTimeout(async () => {
        const result = await pruneEvents();
        app.log.info(`Event pruning: ${result.deletedCount} events deleted, ${result.archivedCount} archived`);
        schedulePruning();
      }, ms);
      timer.unref();
    }
    schedulePruning();
    app.log.info('Event pruning scheduled at 2:00 AM daily');

    // Daily proactive outreach check at 10:00 AM
    function scheduleOutreach() {
      const now = new Date();
      const next = new Date(now);
      next.setHours(10, 0, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      const ms = next.getTime() - now.getTime();
      const timer = setTimeout(async () => {
        const result = await runProactiveOutreach();
        app.log.info(`Proactive outreach: ${result.sentCount} sent, ${result.skippedCount} skipped`);
        scheduleOutreach();
      }, ms);
      timer.unref();
    }
    scheduleOutreach();
    app.log.info('Proactive outreach check scheduled at 10:00 AM daily');

    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`Gateway listening on http://localhost:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

export { app };
