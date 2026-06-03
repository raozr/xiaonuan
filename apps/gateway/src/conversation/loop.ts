import { createPiAgent } from '../agent/pi-agent.js';
import {
  saveMessage,
  incrementTurnCount,
  getSessionPhase,
  getRecentMessages,
} from './turn-manager.js';
import { buildSystemPrompt } from '../agent/prompt-builder.js';
import { chatCompletion } from '../services/dashscope.js';
import { generateCheckpoint } from '../memory/checkpoint-service.js';
import { synthesizeForPairing } from '../services/voice.js';
import { cleanLLMResponse } from '../agent/response-cleaner.js';
import { randomUUID } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { WebSocket } from '@fastify/websocket';
import { enqueueExtraction } from '../services/extraction-service.js';
import { env } from '../config/env.js';
import { logEvent, logPerf, nowMs } from '../utils/observability.js';
import { sendWsMessage } from '../websocket/messages.js';

function defaultBaseUrl() {
  return env.PUBLIC_BASE_URL || `http://localhost:${env.PORT}`;
}

function firstSpeakableSegment(text: string, maxChars = 120) {
  if (text.length <= maxChars) return text;
  const sentence = text.split(/(?<=[。！？!?])/)[0]?.trim();
  if (sentence && sentence.length >= 8 && sentence.length <= maxChars) {
    return sentence;
  }
  return `${text.slice(0, maxChars).trim()}。`;
}

async function publishAudioResponse(
  pairingId: string,
  aiText: string,
  socket: WebSocket,
  baseUrl: string,
  meta: Record<string, unknown>
) {
  const ttsStart = nowMs();
  try {
    logEvent('info', 'Starting TTS', { ...meta, stage: 'tts.start' });
    const ttsText = firstSpeakableSegment(aiText);
    const result = await synthesizeForPairing(pairingId, ttsText);
    logPerf('tts.synthesize', ttsStart, { ...meta, chars: ttsText.length });

    let audioUrl = result.audioUrl;
    if (result.audioBuffer) {
      const writeStart = nowMs();
      const fileName = `${randomUUID()}.mp3`;
      const ttsDir = join(process.cwd(), 'public', 'tts');
      await mkdir(ttsDir, { recursive: true });
      const filePath = join(ttsDir, fileName);
      await writeFile(filePath, result.audioBuffer);
      audioUrl = `${baseUrl}/tts/${fileName}`;
      logPerf('tts.write_file', writeStart, meta);
    }

    const sendStart = nowMs();
    sendWsMessage(socket, 'ai:audio', { url: audioUrl });
    logPerf('ws.send.audio', sendStart, meta);
    logEvent('info', 'Audio response sent', { ...meta, stage: 'ws.send.audio' });
  } catch (ttsErr) {
    logEvent('error', 'TTS failed', {
      ...meta,
      stage: 'tts.error',
      errorCode: 'TTS_FAILED',
      error: ttsErr instanceof Error ? ttsErr.message : String(ttsErr),
    });
    sendWsMessage(socket, 'ai:audio_unavailable', {
      message: '语音播放失败，请稍后再试',
    });
  } finally {
    logPerf('tts.total', ttsStart, meta);
  }
}

export async function handleVoiceText(
  sessionId: string,
  pairingId: string,
  text: string,
  socket: WebSocket,
  baseUrl: string = defaultBaseUrl()
) {
  const totalStart = nowMs();
  const meta: Record<string, unknown> = { sessionId, pairingId };
  try {
    logEvent('info', 'handleVoiceText start', { ...meta, stage: 'turn.start' });

    // 1. Save companionee message
    const saveUserStart = nowMs();
    await saveMessage(sessionId, 'COMPANIONEE', text);
    logPerf('db.save_user_message', saveUserStart, meta);

    // 1.5 Extract info from companionee message (async, non-blocking)
    setImmediate(() => {
      enqueueExtraction('conversation', pairingId, text, 'COMPANIONEE')
        .catch((err) =>
          logEvent('error', 'companionee extraction failed', {
            ...meta,
            stage: 'extraction.enqueue',
            errorCode: 'EXTRACTION_ENQUEUE_FAILED',
            error: err instanceof Error ? err.message : String(err),
          })
        );
    });

    // 2. Increment turn count
    const turnStart = nowMs();
    const session = await incrementTurnCount(sessionId);
    meta.turnCount = session.turnCount;
    logPerf('db.increment_turn', turnStart, meta);

    // 2.5 Every 5 turns, trigger checkpoint generation asynchronously
    if (session.turnCount % 5 === 0) {
      setImmediate(() => {
        generateCheckpoint(sessionId).catch((err) => {
          logEvent('error', 'incremental checkpoint failed', {
            ...meta,
            stage: 'checkpoint.generate',
            errorCode: 'CHECKPOINT_FAILED',
            error: err instanceof Error ? err.message : String(err),
          });
        });
      });
    }

    // 3. Process with Pi Agent
    const phaseStart = nowMs();
    const currentPhase = await getSessionPhase(sessionId);
    logPerf('db.get_phase', phaseStart, { ...meta, phase: currentPhase });
    const agentStart = nowMs();
    const agent = await createPiAgent({
      pairingId,
      phase: currentPhase,
    });
    logPerf('agent.create', agentStart, meta);

    const llmStart = nowMs();
    const aiText = await agent.processMessage(text, {
      sessionId,
      turnCount: session.turnCount,
    });
    logPerf('agent.process_message', llmStart, meta);

    const cleanText = cleanLLMResponse(aiText) || '我在听，您继续说。';

    // 4. Save AI message
    const saveAiStart = nowMs();
    await saveMessage(sessionId, 'AI', cleanText);
    logPerf('db.save_ai_message', saveAiStart, meta);

    // 5. Send text immediately, then synthesize audio asynchronously.
    const sendTextStart = nowMs();
    sendWsMessage(socket, 'message:ai_text', { text: cleanText });
    logPerf('ws.send.text', sendTextStart, meta);
    logPerf('turn.text_ready', totalStart, meta);

    setImmediate(() => {
      publishAudioResponse(pairingId, cleanText, socket, baseUrl, meta)
        .catch((err) =>
          logEvent('error', 'async TTS publish failed', {
            ...meta,
            stage: 'tts.publish',
            errorCode: 'TTS_PUBLISH_FAILED',
            error: err instanceof Error ? err.message : String(err),
          })
        );
    });
  } catch (err) {
    logEvent('error', 'handleVoiceText error', {
      ...meta,
      stage: 'turn.error',
      errorCode: 'TURN_FAILED',
      error: err instanceof Error ? err.message : String(err),
    });
    const message = err instanceof Error ? err.message : '处理失败';
    try {
      sendWsMessage(socket, 'error', { message, code: 'TURN_FAILED' });
    } catch (sendErr) {
      logEvent('error', 'failed to send error to socket', {
        ...meta,
        stage: 'ws.send.error',
        errorCode: 'WS_SEND_FAILED',
        error: sendErr instanceof Error ? sendErr.message : String(sendErr),
      });
    }
  } finally {
    logPerf('turn.total_until_text', totalStart, meta);
  }
}

export async function sendClosingMessage(
  sessionId: string,
  pairingId: string,
  socket: WebSocket,
  baseUrl: string = defaultBaseUrl()
) {
  try {
    const recentMessages = await getRecentMessages(sessionId, 6);
    const systemPrompt = await buildSystemPrompt(pairingId, [], {
      time: new Date(),
      turnCount: 0,
      memoryText: '',
    });
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system' as const,
        content: `${systemPrompt}\n\n当前情境：对方已 3 分钟未说话。请根据上面的聊天记录，结合对方最近提到的事（比如运动、钓鱼、休息等），说一句简短、温暖、有针对性的关心话（2-3句话），不要泛泛地说"歇着"。`,
      },
      ...recentMessages,
      { role: 'user' as const, content: '（静默）' },
    ];
    const reply = await chatCompletion(messages, {
      temperature: 0.85,
      maxTokens: 128,
    });
    const aiText = cleanLLMResponse(reply.content ?? '再见。') || '那您先歇着，我在这儿陪您。';
    await saveMessage(sessionId, 'AI', aiText);
    sendWsMessage(socket, 'message:ai_text', { text: aiText });

    setImmediate(() => {
      publishAudioResponse(pairingId, aiText, socket, baseUrl, { sessionId, pairingId })
        .catch((err) =>
          logEvent('error', 'closing message TTS failed', {
            sessionId,
            pairingId,
            stage: 'closing.tts',
            errorCode: 'CLOSING_TTS_FAILED',
            error: err instanceof Error ? err.message : String(err),
          })
        );
    });
  } catch (err) {
    logEvent('error', 'send closing message failed', {
      sessionId,
      pairingId,
      stage: 'closing.error',
      errorCode: 'CLOSING_FAILED',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
