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
import { performance } from 'perf_hooks';

function defaultBaseUrl() {
  return env.PUBLIC_BASE_URL || `http://localhost:${env.PORT}`;
}

function elapsedSince(start: number) {
  return Math.round(performance.now() - start);
}

function logTiming(
  label: string,
  start: number,
  meta: Record<string, unknown>,
  extra: Record<string, unknown> = {}
) {
  console.log(`[Perf] ${label}`, {
    ...meta,
    elapsedMs: elapsedSince(start),
    ...extra,
  });
}

function socketSend(socket: WebSocket, type: string, payload: unknown) {
  if (socket.readyState !== 1) return false;
  socket.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
  return true;
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
  const ttsStart = performance.now();
  try {
    console.log('[Loop] starting TTS...');
    const ttsText = firstSpeakableSegment(aiText);
    const result = await synthesizeForPairing(pairingId, ttsText);
    logTiming('tts.synthesize', ttsStart, meta, { chars: ttsText.length });

    let audioUrl = result.audioUrl;
    if (result.audioBuffer) {
      const writeStart = performance.now();
      const fileName = `${randomUUID()}.mp3`;
      const ttsDir = join(process.cwd(), 'public', 'tts');
      await mkdir(ttsDir, { recursive: true });
      const filePath = join(ttsDir, fileName);
      await writeFile(filePath, result.audioBuffer);
      audioUrl = `${baseUrl}/tts/${fileName}`;
      logTiming('tts.write_file', writeStart, meta);
    }

    const sendStart = performance.now();
    socketSend(socket, 'ai:audio', { url: audioUrl });
    logTiming('ws.send.audio', sendStart, meta);
    console.log('[Loop] audio response sent');
  } catch (ttsErr) {
    console.error('[Loop] TTS failed:', ttsErr);
    socketSend(socket, 'ai:audio_unavailable', {
      message: '语音播放失败，请稍后再试',
    });
  } finally {
    logTiming('tts.total', ttsStart, meta);
  }
}

export async function handleVoiceText(
  sessionId: string,
  pairingId: string,
  text: string,
  socket: WebSocket,
  baseUrl: string = defaultBaseUrl()
) {
  const totalStart = performance.now();
  const meta: Record<string, unknown> = { sessionId, pairingId };
  try {
    console.log('[Loop] handleVoiceText start', { sessionId, pairingId, text });

    // 1. Save companionee message
    const saveUserStart = performance.now();
    await saveMessage(sessionId, 'COMPANIONEE', text);
    logTiming('db.save_user_message', saveUserStart, meta);
    console.log('[Loop] companionee message saved');

    // 1.5 Extract info from companionee message (async, non-blocking)
    setImmediate(() => {
      enqueueExtraction('conversation', pairingId, text, 'COMPANIONEE')
        .catch((err) => console.error('[Loop] companionee extraction failed:', err));
    });

    // 2. Increment turn count
    const turnStart = performance.now();
    const session = await incrementTurnCount(sessionId);
    meta.turnCount = session.turnCount;
    logTiming('db.increment_turn', turnStart, meta);
    console.log('[Loop] turn count incremented to', session.turnCount);

    // 2.5 Every 5 turns, trigger checkpoint generation asynchronously
    if (session.turnCount % 5 === 0) {
      setImmediate(() => {
        generateCheckpoint(sessionId).catch((err) => {
          console.error('[Loop] 增量 checkpoint 失败:', err);
        });
      });
    }

    // 3. Process with Pi Agent
    const phaseStart = performance.now();
    const currentPhase = await getSessionPhase(sessionId);
    logTiming('db.get_phase', phaseStart, meta, { phase: currentPhase });
    console.log('[Loop] creating PiAgent phase=', currentPhase);
    const agentStart = performance.now();
    const agent = await createPiAgent({
      pairingId,
      phase: currentPhase,
    });
    logTiming('agent.create', agentStart, meta);
    console.log('[Loop] PiAgent created');

    const llmStart = performance.now();
    const aiText = await agent.processMessage(text, {
      sessionId,
      turnCount: session.turnCount,
    });
    logTiming('agent.process_message', llmStart, meta);
    console.log('[Loop] PiAgent response:', aiText.slice(0, 100));

    // 4. Save AI message
    const saveAiStart = performance.now();
    await saveMessage(sessionId, 'AI', aiText);
    logTiming('db.save_ai_message', saveAiStart, meta);
    console.log('[Loop] ai message saved');

    // 5. Send text immediately, then synthesize audio asynchronously.
    const cleanText = cleanLLMResponse(aiText) || '我在听，您继续说。';
    const sendTextStart = performance.now();
    socketSend(socket, 'message:ai_text', { text: cleanText });
    logTiming('ws.send.text', sendTextStart, meta);
    console.log('[Loop] text response sent');
    logTiming('turn.text_ready', totalStart, meta);

    setImmediate(() => {
      publishAudioResponse(pairingId, cleanText, socket, baseUrl, meta)
        .catch((err) => console.error('[Loop] async TTS publish failed:', err));
    });
  } catch (err) {
    console.error('[Loop] handleVoiceText error:', err);
    const message = err instanceof Error ? err.message : '处理失败';
    try {
      socket.send(
        JSON.stringify({
          type: 'error',
          payload: { message },
          timestamp: Date.now(),
        })
      );
    } catch (sendErr) {
      console.error('[Loop] failed to send error to socket:', sendErr);
    }
  } finally {
    logTiming('turn.total_until_text', totalStart, meta);
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
    socket.send(
      JSON.stringify({
        type: 'message:ai_text',
        payload: { text: aiText },
        timestamp: Date.now(),
      })
    );

    setImmediate(() => {
      publishAudioResponse(pairingId, aiText, socket, baseUrl, { sessionId, pairingId })
        .catch((err) => console.error('[Loop] closing message TTS failed:', err));
    });
  } catch (err) {
    console.error('[Loop] 发送道别语失败:', err);
  }
}
