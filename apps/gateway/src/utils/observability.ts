import { performance } from 'perf_hooks';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ConversationLogMeta {
  sessionId?: string | null;
  pairingId?: string | null;
  turnCount?: number;
  stage?: string;
  errorCode?: string;
  [key: string]: unknown;
}

export function nowMs() {
  return performance.now();
}

export function elapsedSince(start: number) {
  return Math.round(performance.now() - start);
}

export function logEvent(level: LogLevel, message: string, meta: ConversationLogMeta = {}) {
  const payload = {
    message,
    ...meta,
  };

  if (level === 'error') {
    console.error(payload);
  } else if (level === 'warn') {
    console.warn(payload);
  } else {
    console.log(payload);
  }
}

export function logPerf(stage: string, start: number, meta: ConversationLogMeta = {}) {
  logEvent('info', '[Perf]', {
    ...meta,
    stage,
    elapsedMs: elapsedSince(start),
  });
}

