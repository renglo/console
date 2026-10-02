import {
    Send,
} from "lucide-react"
import { useEffect } from "react";
import { useChatSocket } from "@/components/console/chat-socket";
import type { WebSocketPayload } from "@/hooks/useWebSocket";

interface ButtonProps {
  messageUp: (response: any) => void;
  messageReset: (value: boolean) => void;
  message: string;
  payload?: WebSocketPayload;
  trigger?: boolean;
}

export default function WebSocketButton({messageUp,messageReset,message,payload = {} as WebSocketPayload, trigger}: ButtonProps) {

    const { sendMessage, isConnected } = useChatSocket();

    useEffect(() => {
        if (trigger) {
            handleSendMessage();
        }
    }, [trigger]);

    const handleSendMessage = () => {
        const success = sendMessage(message, payload);
        
        if (success) {
            const msg = {
                "type": 'rq',
                "doc": {
                    "author_id": sessionStorage.cu_handle,
                    "time": Math.floor(Date.now() / 1000),
                    "messages": [{"_out": {"role": "user", "content": message}, "_type": "text"}]
                }
            };
            messageUp(msg);
            messageReset(true);
        } else {
            messageReset(false);
        }
    };

    return (
        <span className="flex items-center">
          <Send 
            onClick={handleSendMessage} 
            className={`h-5 w-5 ${!isConnected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            style={{ pointerEvents: isConnected ? 'auto' : 'none' }}
          />
        </span>     
    )
}
