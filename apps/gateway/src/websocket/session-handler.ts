import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import { prisma } from '@xiaonuan/prisma';
import { handleVoiceText, sendClosingMessage } from '../conversation/loop.js';
import { definePhaseTransition } from '../state-machine/index.js';
import {
  updateSessionPhase,
  getSessionPhase,
} from '../conversation/turn-manager.js';
import { generateCheckpoint } from '../memory/checkpoint-service.js';

export function createWebSocketHandler(app: FastifyInstance) {
  return async (socket: WebSocket, req: FastifyRequest) => {
    // Auth
    let user: { familyId?: string; role?: string; deviceId?: string; userId?: string } | null = null;
    try {
      const token =
        (req.query as Record<string, string>)?.token ||
        req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        socket.close();
        return;
      }
      user = app.jwt.verify(token) as { familyId?: string; role?: string; deviceId?: string; userId?: string };
    } catch {
      socket.close();
      return;
    }

    if (!user?.familyId) {
      // For children, familyId is optional in the token (they pass it per request or we need to find it)
      // But for elders, it's mandatory.
      if (user?.role !== 'CHILD') {
        socket.close();
        return;
      }
    }

    // Verify elder deviceId if applicable
    if (user?.role === 'ELDER' && user.deviceId) {
      const profile = await prisma.elderProfile.findUnique({
        where: { familyId: user.familyId },
        select: { deviceId: true }
      });
      if (!profile || profile.deviceId !== user.deviceId) {
        socket.close();
        return;
      }
    }

    let sessionId: string | null = null;
    let missedPongs = 0;
    let heartbeatInterval: NodeJS.Timeout | null = null;
    let silenceTimeout: NodeJS.Timeout | null = null;
    let checkpointTimeout: NodeJS.Timeout | null = null;

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

    function resetSilenceTimer() {
      if (silenceTimeout) {
        clearTimeout(silenceTimeout);
        silenceTimeout = null;
      }
      silenceTimeout = setTimeout(() => {
        handleSilence();
      }, 30000);
    }

    function clearSilenceTimer() {
      if (silenceTimeout) {
        clearTimeout(silenceTimeout);
        silenceTimeout = null;
      }
    }

    async function handleSilence() {
      if (!sessionId) return;
      try {
        const currentPhase = await getSessionPhase(sessionId);
        if (currentPhase === 'ACTIVE_CHAT' || currentPhase === 'GREETING') {
          const newPhase = definePhaseTransition(
            currentPhase,
            'elder_silent_30s'
          );
          await updateSessionPhase(sessionId, newPhase);
          sendMessage('phase:changed', { phase: newPhase });
          await sendClosingMessage(sessionId, user!.familyId!, socket);
          clearSilenceTimer();
        }
      } catch (err) {
        console.error('[WebSocket] 静默检测处理失败:', err);
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
              phase: 'GREETING',
            },
          });
          sessionId = session.id;
          sendMessage('session:created', { sessionId: session.id });
          resetSilenceTimer();
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
          if (checkpointTimeout) {
            clearTimeout(checkpointTimeout);
            checkpointTimeout = null;
          }
          sendMessage('session:resumed', { sessionId: session.id });
          resetSilenceTimer();
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

          const currentPhase = await getSessionPhase(sessionId);

          if (currentPhase === 'CLOSING') {
            const newPhase = definePhaseTransition(
              'CLOSING',
              'elder_speaks_again'
            );
            await updateSessionPhase(sessionId, newPhase);
            sendMessage('phase:changed', { phase: newPhase });
          }

          clearSilenceTimer();
          await handleVoiceText(sessionId, user!.familyId!, text, socket);
          resetSilenceTimer();

          if (currentPhase === 'GREETING') {
            const newPhase = definePhaseTransition(
              'GREETING',
              'first_message_received'
            );
            await updateSessionPhase(sessionId, newPhase);
            sendMessage('phase:changed', { phase: newPhase });
          }

          return;
        }
      } catch (err) {
        sendMessage('error', { message: '消息格式错误' });
      }
    });

    socket.on('close', () => {
      stopHeartbeat();
      clearSilenceTimer();
      if (sessionId) {
        checkpointTimeout = setTimeout(async () => {
          try {
            const newPhase = definePhaseTransition(
              await getSessionPhase(sessionId!),
              'session_close'
            );
            await updateSessionPhase(sessionId!, newPhase);
            await prisma.session.update({
              where: { id: sessionId! },
              data: { endedAt: new Date() },
            });
            await generateCheckpoint(sessionId!);
          } catch (err) {
            console.error('[WebSocket] 关闭会话处理失败:', err);
          }
        }, 5 * 60 * 1000);
      }
    });
  };
}
