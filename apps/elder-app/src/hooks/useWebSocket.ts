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
  const maxReconnects = 5;

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
        setLastMessage(message);
      } catch (e) {
        console.error('[WS] Failed to parse message', e);
      }
    };

    ws.current.onclose = (e) => {
      console.log('[WS] Disconnected', e.reason);
      setIsConnected(false);
      
      // Auto-reconnect with exponential backoff
      if (reconnectCount.current < maxReconnects) {
        const timeout = Math.pow(2, reconnectCount.current) * 1000;
        setTimeout(() => {
          reconnectCount.current++;
          connect();
        }, timeout);
      }
    };

    ws.current.onerror = (e) => {
      console.error('[WS] Error', e);
    };
  }, [url, token]);

  useEffect(() => {
    connect();
    return () => {
      ws.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((type: string, payload: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
    } else {
      console.warn('[WS] Cannot send message, socket not open');
    }
  }, []);

  return { isConnected, lastMessage, sendMessage };
}
