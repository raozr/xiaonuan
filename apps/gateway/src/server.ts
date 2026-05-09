import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { env } from './config/env.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { familyRoutes } from './routes/family.js';

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

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`Gateway listening on http://localhost:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

export { app };
