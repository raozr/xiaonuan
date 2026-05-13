import { createPiAgent } from '../agent/pi-agent.js';
import {
  saveMessage,
  incrementTurnCount,
  getSessionPhase,
} from './turn-manager.js';
import { buildSystemPrompt } from '../agent/prompt-builder.js';
import { chatCompletion } from '../services/dashscope.js';
import { generateCheckpoint } from '../memory/checkpoint-service.js';
import { synthesizeSpeech } from '../services/nls.js';
import { cleanLLMResponse } from '../agent/response-cleaner.js';
import { randomUUID } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { WebSocket } from '@fastify/websocket';

export async function handleVoiceText(
  sessionId: string,
  familyId: string,
  text: string,
  socket: WebSocket,
  baseUrl: string = 'http://192.168.4.70:3000'
) {
  try {
    console.log('[Loop] handleVoiceText start', { sessionId, familyId, text });

    // 1. Save elder message
    await saveMessage(sessionId, 'ELDER', text);
    console.log('[Loop] elder message saved');

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
      familyId,
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
      const audioBuffer = await synthesizeSpeech(aiText);
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

    // 6. Send text + audio response
    const textMsg = JSON.stringify({
      type: 'message:ai_text',
      payload: { text: aiText },
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
  familyId: string,
  socket: WebSocket,
  baseUrl: string = 'http://192.168.4.70:3000'
) {
  try {
    const systemPrompt = await buildSystemPrompt(familyId, [], {
      time: new Date(),
      turnCount: 0,
      memoryText: '',
    });
    const messages = [
      {
        role: 'system' as const,
        content: `${systemPrompt}\n\n当前情境：老人已 30 秒未说话，请温和地道别，说一句简短的关心话（2-3句话）。`,
      },
      { role: 'user' as const, content: '（静默）' },
    ];
    const reply = await chatCompletion(messages, {
      temperature: 0.85,
      maxTokens: 128,
    });
    const aiText = cleanLLMResponse(reply.content ?? '再见。');
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
      const audioBuffer = await synthesizeSpeech(aiText);
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
