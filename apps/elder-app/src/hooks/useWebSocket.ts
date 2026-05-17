import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
}

export function useWebSocket(url: string, token: string, onMessage?: (msg: WebSocketMessage) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    const fullUrl = `${url}?token=${token}`;
    ws.current = new WebSocket(fullUrl);

    ws.current.onopen = () => {
      console.log('[WS] Connected');
      setIsConnected(true);
      reconnectCount.current = 0;
    };

    ws.current.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        console.log('[WS] Received:', message.type, JSON.stringify(message.payload).slice(0, 120));
        if (message.type === 'ping') {
          if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'pong', payload: {}, timestamp: Date.now() }));
          }
          return;
        }
        onMessageRef.current?.(message);
      } catch (e) {
        console.error('[WS] Failed to parse message', e);
      }
    };

    ws.current.onclose = (e) => {
      console.log('[WS] Disconnected code=', e.code, 'reason=', e.reason);
      setIsConnected(false);
      ws.current = null;

      clearReconnectTimer();

      if (appState.current === 'background') {
        return;
      }

      const timeout = Math.min(Math.pow(2, reconnectCount.current) * 1000, 60000);
      reconnectTimer.current = setTimeout(() => {
        reconnectCount.current++;
        connect();
      }, timeout);
    };

    ws.current.onerror = (e) => {
      const target = e.target as WebSocket | undefined;
      if (target?.readyState === WebSocket.CLOSED) {
        return;
      }
      console.warn('[WS] Error event:', {
        type: e.type,
        target: target?.url,
        readyState: target?.readyState,
      });
    };
  }, [url, token, clearReconnectTimer]);

  useEffect(() => {
    connect();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const prevState = appState.current;
      appState.current = nextAppState;

      if (prevState === 'background' && nextAppState === 'active') {
        if (ws.current?.readyState !== WebSocket.OPEN) {
          reconnectCount.current = 0;
          connect();
        }
      } else if (nextAppState === 'background') {
        clearReconnectTimer();
        ws.current?.close();
      }
    });

    return () => {
      subscription.remove();
      clearReconnectTimer();
      ws.current?.close();
    };
  }, [connect, clearReconnectTimer]);

  const sendMessage = useCallback((type: string, payload: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      const msg = JSON.stringify({ type, payload, timestamp: Date.now() });
      console.log('[WS] Send:', type, JSON.stringify(payload).slice(0, 120));
      ws.current.send(msg);
      return true;
    } else {
      console.warn('[WS] Cannot send message, socket not open. readyState=', ws.current?.readyState);
      return false;
    }
  }, []);

  return { isConnected, sendMessage };
}
