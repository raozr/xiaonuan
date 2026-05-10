import { createPiAgent } from '../agent/pi-agent.js';
import { saveMessage, incrementTurnCount } from './turn-manager.js';
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
    await incrementTurnCount(sessionId);

    // 3. Process with Pi Agent
    const agent = await createPiAgent({
      familyId,
      phase: 'ACTIVE_CHAT',
    });

    const aiText = await agent.processMessage(text);

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
