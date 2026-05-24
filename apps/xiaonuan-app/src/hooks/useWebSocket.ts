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
    // Don't connect if token is missing — avoids 1008 "Missing token" on startup
    // before AsyncStorage has finished loading.
    if (!token) {
      return;
    }

    if (
      ws.current?.readyState === WebSocket.OPEN ||
      ws.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    const fullUrl = `${url}?token=${token}`;
    const socket = new WebSocket(fullUrl);
    ws.current = socket;

    socket.onopen = () => {
      console.log('[WS] Connected');
      setIsConnected(true);
      reconnectCount.current = 0;
    };

    socket.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        if (message.type === 'error') {
          console.error('[WS] Received error:', JSON.stringify(message.payload));
        } else {
          console.log('[WS] Received:', message.type, JSON.stringify(message.payload).slice(0, 120));
        }
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

    socket.onclose = (e) => {
      console.log('[WS] Disconnected code=', e.code, 'reason=', e.reason);
      setIsConnected(false);
      // Only nullify if this socket is still the current one
      if (ws.current === socket) {
        ws.current = null;
      }

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

    socket.onerror = (e) => {
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
