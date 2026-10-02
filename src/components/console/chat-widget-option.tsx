import { Button } from "@/components/ui/button";
import { useChatSocket } from "@/components/console/chat-socket";
import type { WebSocketPayload } from "@/hooks/useWebSocket";

interface OptionItem {
  _out: Record<string, string>;
}

interface ChatWidgetOptionProps {
  key_id?: string | number;
  item: OptionItem;
  messageUp?: (msg: any) => void;
  payload?: WebSocketPayload;
}

export default function ChatWidgetOption({
  key_id,
  item,
  messageUp,
  payload = {},
}: ChatWidgetOptionProps) {
  const { sendMessage, isConnected } = useChatSocket();

  const options = item?._out ?? {};
  const question = options["question"];
  const optionEntries = Object.entries(options).filter(
    ([key]) => key !== "question"
  );

  const handleOptionClick = (key: string) => {
    if (!isConnected || !messageUp) return;
    const success = sendMessage(key, payload);
    if (success) {
      messageUp({
        type: "rq",
        doc: {
          author_id: sessionStorage.cu_handle,
          time: Math.floor(Date.now() / 1000),
          messages: [
            {
              _out: { role: "user", content: key },
              _type: "text",
            },
          ],
        },
      });
    }
  };

  return (
    <span
      key={key_id}
      className="flex flex-col mb-4 w-full max-w-[75%] mx-auto gap-2"
    >
      {question && (
        <p className="text-sm text-muted-foreground">{question}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {optionEntries.map(([key, label]) => (
          <Button
            key={key}
            variant="outline"
            size="sm"
            onClick={() => handleOptionClick(key)}
            disabled={!isConnected}
            className="font-medium"
          >
            {label}
          </Button>
        ))}
      </div>
    </span>
  );
}
