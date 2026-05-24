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

export async function handleVoiceText(
  sessionId: string,
  pairingId: string,
  text: string,
  socket: WebSocket,
  baseUrl: string = 'http://192.168.4.70:3000'
) {
  try {
    console.log('[Loop] handleVoiceText start', { sessionId, pairingId, text });

    // 1. Save companionee message
    await saveMessage(sessionId, 'COMPANIONEE', text);
    console.log('[Loop] companionee message saved');

    // 1.5 Extract info from companionee message (async, non-blocking)
    setImmediate(() => {
      enqueueExtraction('conversation', pairingId, text, 'COMPANIONEE')
        .catch((err) => console.error('[Loop] companionee extraction failed:', err));
    });

    // 2. Increment turn count
    const session = await incrementTurnCount(sessionId);
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
    const currentPhase = await getSessionPhase(sessionId);
    console.log('[Loop] creating PiAgent phase=', currentPhase);
    const agent = await createPiAgent({
      pairingId,
      phase: currentPhase,
    });
    console.log('[Loop] PiAgent created');

    const aiText = await agent.processMessage(text, {
      sessionId,
      turnCount: session.turnCount,
    });
    console.log('[Loop] PiAgent response:', aiText.slice(0, 100));

    // 4. Save AI message
    await saveMessage(sessionId, 'AI', aiText);
    console.log('[Loop] ai message saved');

    // 5. TTS synthesis
    let audioUrl: string | null = null;
    try {
      console.log('[Loop] starting TTS...');
      const { audioBuffer } = await synthesizeForPairing(pairingId, aiText);
      const fileName = `${randomUUID()}.mp3`;
      const ttsDir = join(process.cwd(), 'public', 'tts');
      await mkdir(ttsDir, { recursive: true });
      const filePath = join(ttsDir, fileName);
      await writeFile(filePath, audioBuffer);
      // Use full URL so mobile client can play it
      audioUrl = `${baseUrl}/tts/${fileName}`;
      console.log('[Loop] TTS done, url=', audioUrl);
    } catch (ttsErr) {
      console.error('[Loop] TTS failed:', ttsErr);
    }

    // 6. Send text + audio response (defensive re-clean before sending)
    const cleanText = cleanLLMResponse(aiText) || '我在听，您继续说。';
    const textMsg = JSON.stringify({
      type: 'message:ai_text',
      payload: { text: cleanText },
      timestamp: Date.now(),
    });
    socket.send(textMsg);
    console.log('[Loop] text response sent');

    if (audioUrl) {
      const audioMsg = JSON.stringify({
        type: 'ai:audio',
        payload: { url: audioUrl },
        timestamp: Date.now(),
      });
      socket.send(audioMsg);
      console.log('[Loop] audio response sent');
    }
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
  }
}

export async function sendClosingMessage(
  sessionId: string,
  pairingId: string,
  socket: WebSocket,
  baseUrl: string = 'http://192.168.4.70:3000'
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

    // TTS for closing message
    try {
      const { audioBuffer } = await synthesizeForPairing(pairingId, aiText);
      const fileName = `${randomUUID()}.mp3`;
      const ttsDir = join(process.cwd(), 'public', 'tts');
      await mkdir(ttsDir, { recursive: true });
      const filePath = join(ttsDir, fileName);
      await writeFile(filePath, audioBuffer);
      const audioUrl = `${baseUrl}/tts/${fileName}`;
      socket.send(
        JSON.stringify({
          type: 'ai:audio',
          payload: { url: audioUrl },
          timestamp: Date.now(),
        })
      );
    } catch (ttsErr) {
      console.error('[Loop] closing message TTS failed:', ttsErr);
    }
  } catch (err) {
    console.error('[Loop] 发送道别语失败:', err);
  }
}
