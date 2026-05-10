import type { FastifyInstance } from 'fastify';
import { createWebSocketHandler } from '../websocket/session-handler.js';

export async function sessionRoutes(app: FastifyInstance) {
  app.get('/ws', { websocket: true }, createWebSocketHandler(app));
}
