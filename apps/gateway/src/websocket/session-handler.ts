import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import { prisma } from '@xiaonuan/prisma';
import { env } from '../config/env.js';
import { handleVoiceText, sendClosingMessage } from '../conversation/loop.js';
import { definePhaseTransition } from '../state-machine/index.js';
import {
  updateSessionPhase,
  getSessionPhase,
} from '../conversation/turn-manager.js';
import { generateCheckpoint } from '../memory/checkpoint-service.js';
import { transcribeVoice } from '../services/voice-service-client.js';
import { convertM4aToWav } from '../utils/audio-convert.js';

type AuthUser = { pairingId?: string; role?: string; deviceId?: string; userId?: string };

export function createWebSocketHandler(app: FastifyInstance) {
  return async (socket: WebSocket, req: FastifyRequest) => {
    let sessionId: string | null = null;
    let missedPongs = 0;
    let heartbeatInterval: NodeJS.Timeout | null = null;
    let silenceTimeout: NodeJS.Timeout | null = null;
    let checkpointTimeout: NodeJS.Timeout | null = null;
    let authenticatedUser: AuthUser | null = null;
    let closingMessageSent = false;

    let authResolve!: (user: AuthUser) => void;
    let authReject!: (reason: string) => void;
    const authPromise = new Promise<AuthUser>((resolve, reject) => {
      authResolve = resolve;
      authReject = (reason: string) => {
        reject(reason);
        // Swallow the rejection so it doesn't become unhandled
      };
    });
    // Prevent unhandled rejection when auth fails early
    authPromise.catch(() => {});

    const baseUrl =
      env.PUBLIC_BASE_URL ||
      `${(req.headers['x-forwarded-proto'] as string) || req.protocol}://${req.hostname}${req.port ? ':' + req.port : ''}`;

    startHeartbeat();

    function sendMessage(type: string, payload: unknown) {
      if (socket.readyState !== 1) return;
      socket.send(
        JSON.stringify({ type, payload, timestamp: Date.now() })
      );
    }

    function startHeartbeat() {
      heartbeatInterval = setInterval(() => {
        if (missedPongs >= 2) {
          socket.close(1001, 'Heartbeat timeout');
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
      }, 180000);
    }

    function clearSilenceTimer() {
      if (silenceTimeout) {
        clearTimeout(silenceTimeout);
        silenceTimeout = null;
      }
    }

    async function handleSilence() {
      if (!sessionId) return;
      if (closingMessageSent) return;
      const user = authenticatedUser;
      if (!user?.pairingId) return;
      try {
        const currentPhase = await getSessionPhase(sessionId);
        if (currentPhase === 'ACTIVE_CHAT' || currentPhase === 'GREETING') {
          const newPhase = definePhaseTransition(
            currentPhase,
            'elder_silent_timeout'
          );
          await updateSessionPhase(sessionId, newPhase);
          sendMessage('phase:changed', { phase: newPhase });
          await sendClosingMessage(sessionId, user.pairingId, socket, baseUrl);
          closingMessageSent = true;
          clearSilenceTimer();
        }
      } catch (err) {
        console.error('[WebSocket] 静默检测处理失败:', err);
      }
    }

    // Register handlers IMMEDIATELY before any async auth
    socket.on('message', async (raw: Buffer) => {
      let user: AuthUser;
      try {
        user = await authPromise;
      } catch {
        return;
      }

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
              pairingId: user.pairingId!,
              phase: 'GREETING',
            },
          });
          sessionId = session.id;
          app.log.info(`[WS] session created id=${session.id}`);
          sendMessage('session:created', { sessionId: session.id });
          // 新会话在老人首次说话前不启动静默计时，避免还没说话就收到道别
          return;
        }

        if (type === 'session:resume') {
          const targetId = payload?.sessionId;
          if (!targetId) {
            sendMessage('error', { message: 'sessionId 必填' });
            return;
          }
          const session = await prisma.session.findFirst({
            where: { id: targetId, pairingId: user.pairingId! },
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
          try {
            await handleVoiceText(sessionId, user.pairingId!, text, socket, baseUrl);
          } finally {
            app.log.info('[WS] handleVoiceText done');
            resetSilenceTimer();
          }

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
            const errMsg = asrErr instanceof Error ? asrErr.message : String(asrErr);
            app.log.error(`[WS] ASR failed: ${errMsg}`);
            try {
              const fs = await import('fs/promises');
              await fs.appendFile('/tmp/gateway-asr.log', `[${new Date().toISOString()}] ASR failed: ${errMsg}\n`, 'utf-8');
            } catch {}
            sendMessage('error', { message: errMsg || '语音识别失败' });
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
          try {
            await handleVoiceText(sessionId, user.pairingId!, text, socket, baseUrl);
          } finally {
            app.log.info('[WS] handleVoiceText done');
            resetSilenceTimer();
          }

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
      authReject('Socket closed');
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

    // Perform auth
    try {
      const token =
        (req.query as Record<string, string>)?.token ||
        req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        authReject('Missing token');
        socket.close(1008, 'Missing token');
        return;
      }
      const user = app.jwt.verify(token) as AuthUser;

      if (!user?.pairingId) {
        if (user?.role !== 'CHILD') {
          authReject('Missing pairingId');
          socket.close(1008, 'Missing pairingId');
          return;
        }
      }

      if (user?.role === 'ELDER' && user.deviceId) {
        try {
          const participant = await prisma.participant.findFirst({
            where: { pairingId: user.pairingId, role: 'ELDER', isAI: false },
            select: { deviceId: true }
          });
          if (!participant || participant.deviceId !== user.deviceId) {
            authReject('Invalid device');
            socket.close(1008, 'Invalid device');
            return;
          }
        } catch (err) {
          app.log.error(`[WebSocket] 验证老人设备失败: ${err instanceof Error ? err.message : String(err)}`);
          authReject('Server error');
          socket.close(1011, 'Server error');
          return;
        }
      }

      authenticatedUser = user;
      authResolve(user);
    } catch {
      authReject('Invalid token');
      socket.close(1008, 'Invalid token');
      return;
    }
  };
}
