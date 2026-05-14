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
import { transcribeVoice } from '../services/voice-service-client.js';
import { convertM4aToWav } from '../utils/audio-convert.js';

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
          await sendClosingMessage(sessionId, user!.familyId!, socket, baseUrl);
          clearSilenceTimer();
        }
      } catch (err) {
        console.error('[WebSocket] 静默检测处理失败:', err);
      }
    }

    const baseUrl = `${req.protocol}://${req.hostname}${req.port ? ':' + req.port : ''}`;

    socket.on('message', async (raw: Buffer) => {
      try {
        const { type, payload } = JSON.parse(raw.toString());
        app.log.info(`[WS] received type=${type} sessionId=${sessionId}`);

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
          app.log.info(`[WS] session created id=${session.id}`);
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
          app.log.info(`[WS] handling voice_text sessionId=${sessionId}`);
          if (!sessionId) {
            app.log.warn('[WS] voice_text rejected: no sessionId');
            sendMessage('error', { message: '会话未创建' });
            return;
          }
          const text = payload?.text;
          if (!text) {
            sendMessage('error', { message: 'text 必填' });
            return;
          }

          const currentPhase = await getSessionPhase(sessionId);
          app.log.info(`[WS] currentPhase=${currentPhase}`);

          if (currentPhase === 'CLOSING') {
            const newPhase = definePhaseTransition(
              'CLOSING',
              'elder_speaks_again'
            );
            await updateSessionPhase(sessionId, newPhase);
            sendMessage('phase:changed', { phase: newPhase });
          }

          clearSilenceTimer();
          app.log.info('[WS] calling handleVoiceText...');
          await handleVoiceText(sessionId, user!.familyId!, text, socket, baseUrl);
          app.log.info('[WS] handleVoiceText done');
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

        if (type === 'message:voice_audio') {
          app.log.info(`[WS] handling voice_audio sessionId=${sessionId}`);
          if (!sessionId) {
            app.log.warn('[WS] voice_audio rejected: no sessionId');
            sendMessage('error', { message: '会话未创建' });
            return;
          }
          const audioBase64 = payload?.audioBase64;
          if (!audioBase64) {
            sendMessage('error', { message: 'audioBase64 必填' });
            return;
          }

          let text: string;
          try {
            app.log.info('[WS] starting ASR...');
            const audioBuffer = Buffer.from(audioBase64, 'base64');
            app.log.info('[WS] converting m4a to wav...');
            const wavBuffer = await convertM4aToWav(audioBuffer);
            app.log.info(`[WS] converted to wav, size=${wavBuffer.length}`);
            const asrResult = await transcribeVoice(wavBuffer, 'wav', 16000);
            text = asrResult.success ? (asrResult.text ?? '') : '';
            app.log.info(`[WS] ASR result: ${text}`);
          } catch (asrErr: any) {
            app.log.error('[WS] ASR failed:', asrErr.message || asrErr);
            sendMessage('error', { message: asrErr.message || '语音识别失败' });
            return;
          }

          if (!text.trim()) {
            sendMessage('error', { message: '未能识别到语音内容' });
            return;
          }

          const currentPhase = await getSessionPhase(sessionId);
          app.log.info(`[WS] currentPhase=${currentPhase}`);

          if (currentPhase === 'CLOSING') {
            const newPhase = definePhaseTransition(
              'CLOSING',
              'elder_speaks_again'
            );
            await updateSessionPhase(sessionId, newPhase);
            sendMessage('phase:changed', { phase: newPhase });
          }

          clearSilenceTimer();
          app.log.info('[WS] calling handleVoiceText with ASR result...');
          await handleVoiceText(sessionId, user!.familyId!, text, socket, baseUrl);
          app.log.info('[WS] handleVoiceText done');
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
        app.log.error(`[WS] message handler error: ${err instanceof Error ? err.message : String(err)}`);
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
