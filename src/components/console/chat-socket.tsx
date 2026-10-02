import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import { useWebSocket, type WebSocketPayload } from "@/hooks/useWebSocket";

export type ChatSocketListener = (data: unknown) => void;

type ChatSocketContextValue = {
  sendMessage: (message: string, payload?: WebSocketPayload) => boolean;
  isConnected: boolean;
  subscribe: (listener: ChatSocketListener) => () => void;
};

const ChatSocketContext = createContext<ChatSocketContextValue | null>(null);

/**
 * One console WebSocket for the chat page that mounts this provider.
 * Inbound frames go to that page's onMessage, then to any subscribe() listeners.
 */
export function ChatSocketProvider({
  children,
  onMessage,
}: {
  children: ReactNode;
  onMessage?: ChatSocketListener;
}) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const listenersRef = useRef(new Set<ChatSocketListener>());

  const { sendMessage, isConnected } = useWebSocket({
    onMessage: (data) => {
      onMessageRef.current?.(data);
      listenersRef.current.forEach((listener) => listener(data));
    },
  });

  const subscribe = useCallback((listener: ChatSocketListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const value = useMemo(
    () => ({ sendMessage, isConnected, subscribe }),
    [sendMessage, isConnected, subscribe]
  );

  return <ChatSocketContext.Provider value={value}>{children}</ChatSocketContext.Provider>;
}

export function useChatSocket() {
  const socket = useContext(ChatSocketContext);
  if (!socket) {
    throw new Error("useChatSocket must be used within ChatSocketProvider");
  }
  return socket;
}
