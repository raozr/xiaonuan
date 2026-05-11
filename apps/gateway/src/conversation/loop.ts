import { createPiAgent } from '../agent/pi-agent.js';
import {
  saveMessage,
  incrementTurnCount,
  getSessionPhase,
} from './turn-manager.js';
import { buildSystemPrompt } from '../agent/prompt-builder.js';
import { chatCompletion } from '../services/dashscope.js';
import { generateCheckpoint } from '../memory/checkpoint-service.js';
import type { WebSocket } from '@fastify/websocket';

export async function handleVoiceText(
  sessionId: string,
  familyId: string,
  text: string,
  socket: WebSocket
) {
  try {
    // 1. Save elder message
    await saveMessage(sessionId, 'ELDER', text);

    // 2. Increment turn count
    const session = await incrementTurnCount(sessionId);

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
    const agent = await createPiAgent({
      familyId,
      phase: currentPhase,
    });

    const aiText = await agent.processMessage(text, {
      sessionId,
      turnCount: session.turnCount,
    });

    // 4. Save AI message
    await saveMessage(sessionId, 'AI', aiText);

    // 5. Send response to client
    socket.send(
      JSON.stringify({
        type: 'message:ai_text',
        payload: { text: aiText },
        timestamp: Date.now(),
      })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : '处理失败';
    socket.send(
      JSON.stringify({
        type: 'error',
        payload: { message },
        timestamp: Date.now(),
      })
    );
  }
}

export async function sendClosingMessage(
  sessionId: string,
  familyId: string,
  socket: WebSocket
) {
  try {
    const systemPrompt = await buildSystemPrompt(familyId);
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
    const aiText = reply.content ?? '再见。';
    await saveMessage(sessionId, 'AI', aiText);
    socket.send(
      JSON.stringify({
        type: 'message:ai_text',
        payload: { text: aiText },
        timestamp: Date.now(),
      })
    );
  } catch (err) {
    console.error('[Loop] 发送道别语失败:', err);
  }
}
