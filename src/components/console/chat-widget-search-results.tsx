import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useWebSocket } from "@/hooks/useWebSocket";

interface SearchResult {
  id: string;
  label: string;
  summary: string;
  attributes_preview: string;
}

interface SearchResultsPayload {
  entity_type: string;
  results: SearchResult[];
  message?: string;
  question?: string;
}

interface ChatWidgetSearchResultsProps {
  key_id?: string | number;
  item: { _out: SearchResultsPayload };
  messageUp?: (msg: any) => void;
  payload?: Record<string, any>;
}

export default function ChatWidgetSearchResults({
  key_id,
  item,
  messageUp,
  payload = {},
}: ChatWidgetSearchResultsProps) {
  const { sendMessage, isConnected } = useWebSocket({
    onMessage: (data) => {
      if (messageUp) {
        messageUp({ type: "rs", update: data });
      }
    },
  });

  const data = item?._out ?? {};
  const results: SearchResult[] = data.results ?? [];
  const question = data.question ?? "Choose the one you mean.";
  const entityLabel = (data.entity_type ?? "item").replace("_", " ");

  const handleResultClick = (index: number) => {
    if (!messageUp) return;
    const selection = String(index + 1);
    if (isConnected) {
      sendMessage(selection, payload);
    }
    messageUp({
      type: "rq",
      doc: {
        author_id: sessionStorage.cu_handle,
        time: Math.floor(Date.now() / 1000),
        messages: [
          {
            _out: { role: "user", content: selection },
            _type: "text",
          },
        ],
      },
    });
  };

  return (
    <span
      key={key_id}
      className="flex flex-col mb-4 w-full max-w-[85%] mx-auto gap-3"
    >
      {question && (
        <p className="text-sm text-muted-foreground">{question}</p>
      )}
      <div className="flex flex-col gap-2">
        {results.map((r, idx) => (
          <Card
            key={r.id}
            className="cursor-pointer transition-colors hover:bg-muted/60 hover:border-primary/40"
            onClick={() => handleResultClick(idx)}
          >
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {entityLabel} {idx + 1}
                </span>
                <span className="text-xs font-semibold text-primary">
                  {r.label}
                </span>
              </div>
            </CardHeader>
            <CardContent className="py-2 px-3 pt-0">
              <p className="text-sm">{r.summary}</p>
              {r.attributes_preview && (
                <p className="text-xs text-muted-foreground mt-1">
                  {r.attributes_preview}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </span>
  );
}
