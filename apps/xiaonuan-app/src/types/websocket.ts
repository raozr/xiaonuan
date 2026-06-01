export type WsErrorCode =
  | 'SESSION_REQUIRED'
  | 'SESSION_ID_REQUIRED'
  | 'SESSION_NOT_FOUND'
  | 'TEXT_REQUIRED'
  | 'AUDIO_REQUIRED'
  | 'ASR_FAILED'
  | 'ASR_EMPTY'
  | 'TTS_FAILED'
  | 'TURN_FAILED'
  | 'WS_MESSAGE_FAILED'
  | string
  | number;

export type WebSocketMessage =
  | { type: 'ping'; payload: Record<string, never>; timestamp: number }
  | { type: 'session:created'; payload: { sessionId: string }; timestamp: number }
  | { type: 'session:resumed'; payload: { sessionId: string }; timestamp: number }
  | { type: 'phase:changed'; payload: { phase: string }; timestamp: number }
  | { type: 'message:ai_text'; payload: { text: string }; timestamp: number }
  | { type: 'ai:audio'; payload: { url?: string }; timestamp: number }
  | { type: 'ai:audio_unavailable'; payload: { message: string }; timestamp: number }
  | {
      type: 'error';
      payload: { message: string; code?: WsErrorCode; debug?: string };
      timestamp: number;
    };

export type ClientWsMessageType = 'session:create' | 'session:resume' | 'message:voice_text' | 'message:voice_audio' | 'pong';

export type ClientWsPayload<T extends ClientWsMessageType> =
  T extends 'session:create'
    ? Record<string, never>
    : T extends 'session:resume'
    ? { sessionId: string }
    : T extends 'message:voice_text'
    ? { text: string }
    : T extends 'message:voice_audio'
    ? { audioBase64: string }
    : Record<string, never>;
