import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
}

export function useWebSocket(url: string, token: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        if (message.type === 'ping') {
          sendMessage('pong', {});
          return;
        }
        setLastMessage(message);
      } catch (e) {
        console.error('[WS] Failed to parse message', e);
      }
    };

    ws.current.onclose = (e) => {
      console.log('[WS] Disconnected', e.reason);
      setIsConnected(false);

      clearReconnectTimer();
      const timeout = Math.min(Math.pow(2, reconnectCount.current) * 1000, 60000);
      reconnectTimer.current = setTimeout(() => {
        reconnectCount.current++;
        connect();
      }, timeout);
    };

    ws.current.onerror = (e) => {
      console.error('[WS] Error', e);
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
      ws.current.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
    } else {
      console.warn('[WS] Cannot send message, socket not open');
    }
  }, []);

  return { isConnected, lastMessage, sendMessage };
}
