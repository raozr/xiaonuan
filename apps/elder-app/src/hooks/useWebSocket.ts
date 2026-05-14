import { useEffect, useRef, useState, useCallback } from 'react';

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

      clearReconnectTimer();
      const timeout = Math.min(Math.pow(2, reconnectCount.current) * 1000, 60000);
      reconnectTimer.current = setTimeout(() => {
        reconnectCount.current++;
        connect();
      }, timeout);
    };

    ws.current.onerror = (e) => {
      console.error('[WS] Error event:', {
        type: e.type,
        target: (e.target as WebSocket)?.url,
        readyState: (e.target as WebSocket)?.readyState,
      });
    };
  }, [url, token, clearReconnectTimer]);

  useEffect(() => {
    connect();
    return () => {
      clearReconnectTimer();
      ws.current?.close();
    };
  }, [connect, clearReconnectTimer]);

  const sendMessage = useCallback((type: string, payload: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      const msg = JSON.stringify({ type, payload, timestamp: Date.now() });
      console.log('[WS] Send:', type, JSON.stringify(payload).slice(0, 120));
      ws.current.send(msg);
    } else {
      console.warn('[WS] Cannot send message, socket not open. readyState=', ws.current?.readyState);
    }
  }, []);

  return { isConnected, sendMessage };
}
