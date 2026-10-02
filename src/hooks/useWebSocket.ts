import { useEffect, useState, useCallback, useRef } from "react";

export interface WebSocketPayload {
  action?: string;
  entity_type?: string;
  entity_id?: string;
  thread?: string;
  portfolio?: string;
  org?: string;
  next?: string;
  core?: string;
}

interface UseWebSocketOptions {
  onMessage?: (data: unknown) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  onClose?: () => void;
  autoReconnect?: boolean;
  reconnectDelay?: number;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const connectingRef = useRef(false);
  const intentionalCloseRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current != null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    if (
      connectingRef.current ||
      (wsRef.current &&
        (wsRef.current.readyState === WebSocket.CONNECTING ||
          wsRef.current.readyState === WebSocket.OPEN))
    ) {
      return;
    }

    intentionalCloseRef.current = false;
    clearReconnectTimer();
    connectingRef.current = true;
    setIsConnecting(true);

    const socket = new WebSocket(`${import.meta.env.VITE_WEBSOCKET_URL}`);

    socket.onopen = () => {
      console.log("WebSocket connected");
      connectingRef.current = false;
      setIsConnecting(false);
      setIsConnected(true);
      callbacksRef.current.onOpen?.();
    };

    socket.onmessage = (event) => {
      console.log("Received message:", event.data);
      const parsedData = JSON.parse(event.data);
      callbacksRef.current.onMessage?.(parsedData);
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      connectingRef.current = false;
      setIsConnecting(false);
      setIsConnected(false);
      callbacksRef.current.onError?.(error);
    };

    socket.onclose = () => {
      console.log("WebSocket disconnected");
      connectingRef.current = false;
      setIsConnecting(false);
      setIsConnected(false);
      if (wsRef.current === socket) {
        wsRef.current = null;
      }
      callbacksRef.current.onClose?.();

      if (intentionalCloseRef.current || callbacksRef.current.autoReconnect === false) {
        return;
      }

      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connectWebSocket();
      }, callbacksRef.current.reconnectDelay || 3000);
    };

    wsRef.current = socket;
  }, [clearReconnectTimer]);

  const sendMessage = useCallback((message: string, payload: WebSocketPayload = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("Message out:", message);

      const core = "core" in payload ? payload.core : "default";

      const ws_payload = {
        action: payload.action,
        data: message,
        auth: `${sessionStorage.accessToken}`,
        entity_type: payload.entity_type,
        entity_id: payload.entity_id,
        thread: payload.thread,
        portfolio: payload.portfolio,
        next: payload.next,
        core: core,
        org: payload.org,
      };

      wsRef.current.send(JSON.stringify(ws_payload));
      return true;
    }

    console.error("WebSocket is not connected.");
    if (!connectingRef.current) {
      connectWebSocket();
    }
    return false;
  }, [connectWebSocket]);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearReconnectTimer();
    wsRef.current?.close();
  }, [clearReconnectTimer]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      intentionalCloseRef.current = true;
      clearReconnectTimer();
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connectWebSocket, clearReconnectTimer]);

  return {
    sendMessage,
    disconnect,
    isConnected,
    isConnecting,
    connect: connectWebSocket,
  };
};
