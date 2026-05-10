import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import { prisma } from '@xiaonuan/prisma';
import { handleVoiceText } from '../conversation/loop.js';

export function createWebSocketHandler(app: FastifyInstance) {
  return async (socket: WebSocket, req: FastifyRequest) => {
    // Auth
    let user: { familyId?: string; role?: string } | null = null;
    try {
      const token =
        (req.query as Record<string, string>)?.token ||
        req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        socket.close();
        return;
      }
      user = app.jwt.verify(token) as { familyId?: string; role?: string };
    } catch {
      socket.close();
      return;
    }

    if (!user?.familyId) {
      socket.close();
      return;
    }

    let sessionId: string | null = null;
    let missedPongs = 0;
    let heartbeatInterval: NodeJS.Timeout | null = null;

    startHeartbeat();

    function sendMessage(type: string, payload: unknown) {
      socket.send(
        JSON.stringify({ type, payload, timestamp: Date.now() })
      );
    }

    function startHeartbeat() {
      heartbeatInterval = setInterval(() => {
        if (missedPongs >= 2) {
          socket.close();
          return;
        }
        missedPongs++;
        sendMessage('ping', {});
      }, 30000);
    }

    function stopHeartbeat() {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    }

    socket.on('message', async (raw: Buffer) => {
      try {
        const { type, payload } = JSON.parse(raw.toString());

        if (type === 'pong') {
          missedPongs = 0;
          return;
        }

        if (type === 'session:create') {
          const session = await prisma.session.create({
            data: {
              familyId: user!.familyId!,
              phase: 'ACTIVE_CHAT',
            },
          });
          sessionId = session.id;
          sendMessage('session:created', { sessionId: session.id });
          return;
        }

        if (type === 'session:resume') {
          const targetId = payload?.sessionId;
          if (!targetId) {
            sendMessage('error', { message: 'sessionId 必填' });
            return;
          }
          const session = await prisma.session.findFirst({
            where: { id: targetId, familyId: user!.familyId! },
          });
          if (!session) {
            sendMessage('error', { message: '会话不存在' });
            return;
          }
          sessionId = session.id;
          sendMessage('session:resumed', { sessionId: session.id });
          return;
        }

        if (type === 'message:voice_text') {
          if (!sessionId) {
            sendMessage('error', { message: '会话未创建' });
            return;
          }
          const text = payload?.text;
          if (!text) {
            sendMessage('error', { message: 'text 必填' });
            return;
          }
          await handleVoiceText(sessionId, user!.familyId!, text, socket);
          return;
        }
      } catch (err) {
        sendMessage('error', { message: '消息格式错误' });
      }
    });

    socket.on('close', () => {
      stopHeartbeat();
    });
  };
}
