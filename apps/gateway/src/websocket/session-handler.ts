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
import { markCheckpointPending } from '../events/checkpoint-persistence.js';
import { elapsedSince, nowMs } from '../utils/observability.js';
import { sendWsMessage } from './messages.js';

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
      sendWsMessage(socket, type as never, payload as never);
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
            'companionee_silent_timeout'
          );
          await updateSessionPhase(sessionId, newPhase);
          sendMessage('phase:changed', { phase: newPhase });
          await sendClosingMessage(sessionId, user.pairingId, socket, baseUrl);
          closingMessageSent = true;
          clearSilenceTimer();
          // Mark checkpoint as pending for later generation
          await markCheckpointPending(sessionId, user.pairingId);
        }
      } catch (err) {
        app.log.error({
          err,
          sessionId,
          pairingId: user.pairingId,
          stage: 'ws.silence',
          errorCode: 'SILENCE_HANDLER_FAILED',
        }, 'WebSocket silence handler failed');
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
        app.log.info({ type, sessionId, pairingId: user.pairingId, stage: 'ws.receive' }, 'WS message received');

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
          app.log.info({ sessionId: session.id, pairingId: user.pairingId, stage: 'ws.session.create' }, 'WS session created');
          sendMessage('session:created', { sessionId: session.id });
          // 新会话在对方首次说话前不启动静默计时，避免还没说话就收到道别
          return;
        }

        if (type === 'session:resume') {
          const targetId = payload?.sessionId;
          if (!targetId) {
            sendMessage('error', { message: 'sessionId 必填', code: 'SESSION_ID_REQUIRED' });
            return;
          }
          const session = await prisma.session.findFirst({
            where: { id: targetId, pairingId: user.pairingId! },
          });
          if (!session) {
            sendMessage('error', { message: '会话不存在', code: 'SESSION_NOT_FOUND' });
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
          const turnStart = nowMs();
          app.log.info({ sessionId, pairingId: user.pairingId, stage: 'ws.voice_text.start' }, 'Handling voice_text');
          if (!sessionId) {
            app.log.warn({ pairingId: user.pairingId, stage: 'ws.voice_text.reject', errorCode: 'SESSION_REQUIRED' }, 'voice_text rejected: no session');
            sendMessage('error', { message: '会话未创建', code: 'SESSION_REQUIRED' });
            return;
          }
          const text = payload?.text;
          if (!text) {
            sendMessage('error', { message: 'text 必填', code: 'TEXT_REQUIRED' });
            return;
          }

          const currentPhase = await getSessionPhase(sessionId);
          app.log.info({ sessionId, pairingId: user.pairingId, phase: currentPhase, stage: 'ws.phase' }, 'Current session phase');

          if (currentPhase === 'CLOSING') {
            const newPhase = definePhaseTransition(
              'CLOSING',
              'companionee_speaks_again'
            );
            await updateSessionPhase(sessionId, newPhase);
            sendMessage('phase:changed', { phase: newPhase });
          }

          clearSilenceTimer();
          try {
            await handleVoiceText(sessionId, user.pairingId!, text, socket, baseUrl);
          } finally {
            app.log.info({
              sessionId,
              pairingId: user.pairingId,
              stage: 'ws.voice_text.handleVoiceText',
              elapsedMs: elapsedSince(turnStart),
            }, '[Perf]');
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
          const turnStart = nowMs();
          app.log.info({ sessionId, pairingId: user.pairingId, stage: 'ws.voice_audio.start' }, 'Handling voice_audio');
          if (!sessionId) {
            app.log.warn({ pairingId: user.pairingId, stage: 'ws.voice_audio.reject', errorCode: 'SESSION_REQUIRED' }, 'voice_audio rejected: no session');
            sendMessage('error', { message: '会话未创建', code: 'SESSION_REQUIRED' });
            return;
          }
          const audioBase64 = payload?.audioBase64;
          if (!audioBase64) {
            sendMessage('error', { message: 'audioBase64 必填', code: 'AUDIO_REQUIRED' });
            return;
          }

          let text: string;
          try {
            const decodeStart = nowMs();
            const audioBuffer = Buffer.from(audioBase64, 'base64');
            app.log.info({
              sessionId,
              pairingId: user.pairingId,
              stage: 'asr.decode_base64',
              elapsedMs: elapsedSince(decodeStart),
              bytes: audioBuffer.length,
            }, '[Perf]');
            const convertStart = nowMs();
            const wavBuffer = await convertM4aToWav(audioBuffer);
            app.log.info({
              sessionId,
              pairingId: user.pairingId,
              stage: 'asr.convert_m4a_to_wav',
              elapsedMs: elapsedSince(convertStart),
              bytes: wavBuffer.length,
            }, '[Perf]');
            const asrStart = nowMs();
            const asrResult = await transcribeVoice(wavBuffer, 'wav', 16000);
            app.log.info({
              sessionId,
              pairingId: user.pairingId,
              stage: 'asr.transcribe',
              elapsedMs: elapsedSince(asrStart),
            }, '[Perf]');
            text = asrResult.success ? (asrResult.text ?? '') : '';
          } catch (asrErr: any) {
            const rawMsg = asrErr instanceof Error ? asrErr.message : String(asrErr);
            app.log.error({
              sessionId,
              pairingId: user.pairingId,
              stage: 'asr.error',
              errorCode: 'ASR_FAILED',
              err: asrErr,
            }, 'ASR failed');
            sendMessage('error', {
              message: '语音识别失败，请稍后再试',
              code: 'ASR_FAILED',
              debug: rawMsg,
            });
            return;
          }

          if (!text.trim()) {
            sendMessage('error', { message: '未能识别到语音内容', code: 'ASR_EMPTY' });
            return;
          }

          const currentPhase = await getSessionPhase(sessionId);
          app.log.info({ sessionId, pairingId: user.pairingId, phase: currentPhase, stage: 'ws.phase' }, 'Current session phase');

          if (currentPhase === 'CLOSING') {
            const newPhase = definePhaseTransition(
              'CLOSING',
              'companionee_speaks_again'
            );
            await updateSessionPhase(sessionId, newPhase);
            sendMessage('phase:changed', { phase: newPhase });
          }

          clearSilenceTimer();
          try {
            await handleVoiceText(sessionId, user.pairingId!, text, socket, baseUrl);
          } finally {
            app.log.info({
              sessionId,
              pairingId: user.pairingId,
              stage: 'ws.voice_audio.total_until_text',
              elapsedMs: elapsedSince(turnStart),
            }, '[Perf]');
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
        app.log.error({ err, sessionId, pairingId: user.pairingId, stage: 'ws.message.error', errorCode: 'WS_MESSAGE_FAILED' }, 'WS message handler error');
        sendMessage('error', { message: '消息格式错误', code: 'WS_MESSAGE_FAILED' });
      }
    });

    socket.on('close', () => {
      stopHeartbeat();
      clearSilenceTimer();
      authReject('Socket closed');
      if (sessionId) {
        // Mark checkpoint as pending before the delayed generation
        const user = authenticatedUser;
        if (user?.pairingId) {
          markCheckpointPending(sessionId, user.pairingId).catch((err) => {
            app.log.error({ err, sessionId, pairingId: user.pairingId, stage: 'checkpoint.pending', errorCode: 'CHECKPOINT_PENDING_FAILED' }, 'Mark checkpoint pending failed');
          });
        }
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
            app.log.error({ err, sessionId, pairingId: user?.pairingId, stage: 'ws.close', errorCode: 'SESSION_CLOSE_FAILED' }, 'WebSocket close session handler failed');
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
        if (user?.role !== 'STEWARD') {
          authReject('Missing pairingId');
          socket.close(1008, 'Missing pairingId');
          return;
        }
      }

      if (user?.role === 'COMPANIONEE' && user.deviceId) {
        try {
          const participant = await prisma.participant.findFirst({
            where: { pairingId: user.pairingId, role: 'COMPANIONEE', isAI: false },
            select: { deviceId: true }
          });
          if (!participant || participant.deviceId !== user.deviceId) {
            authReject('Invalid device');
            socket.close(1008, 'Invalid device');
            return;
          }
        } catch (err) {
          app.log.error({ err, pairingId: user.pairingId, stage: 'ws.auth.device', errorCode: 'DEVICE_AUTH_FAILED' }, 'Companionee device auth failed');
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
