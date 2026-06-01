import type { WebSocket } from '@fastify/websocket';

export type ServerWsMessage =
  | { type: 'ping'; payload: Record<string, never>; timestamp: number }
  | { type: 'session:created'; payload: { sessionId: string }; timestamp: number }
  | { type: 'session:resumed'; payload: { sessionId: string }; timestamp: number }
  | { type: 'phase:changed'; payload: { phase: string }; timestamp: number }
  | { type: 'message:ai_text'; payload: { text: string }; timestamp: number }
  | { type: 'ai:audio'; payload: { url: string | undefined }; timestamp: number }
  | { type: 'ai:audio_unavailable'; payload: { message: string }; timestamp: number }
  | {
      type: 'error';
      payload: { message: string; code?: string | number; debug?: string };
      timestamp: number;
    };

export type ServerWsMessageType = ServerWsMessage['type'];

export function sendWsMessage<T extends ServerWsMessageType>(
  socket: WebSocket,
  type: T,
  payload: Extract<ServerWsMessage, { type: T }>['payload']
) {
  if (socket.readyState !== 1) return false;
  socket.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
  return true;
}

