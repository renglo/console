import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRightCircle } from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";

interface HandoverPayload {
  case_id?: string;
  request?: {
    user_goal?: string;
    action_family?: string;
    action_type?: string;
    original_user_message?: string;
  };
  resolved_entities?: {
    traveler?: { id?: string; label?: string; data?: Record<string, unknown> } | null;
    trip?: { id?: string; label?: string; data?: Record<string, unknown> } | null;
    hotel?: unknown;
    reservation?: unknown;
    segment?: unknown;
  };
  candidate_summary?: Record<string, unknown[]>;
  pending_context?: unknown[];
  conversation_context?: Record<string, unknown>;
}

interface Handover {
  type: string;
  message: string;
  target_agent: string;
  payload?: HandoverPayload;
  timestamp?: string;
}

interface ChatWidgetHandoverProps {
  key_id?: string | number;
  item: { _out: Handover };
  messageUp?: (msg: { type: string }) => void;
  payload?: Record<string, unknown>;
}

const AGENT_LABELS: Record<string, string> = {
  booking_agent: "Booking",
  changes_agent: "Change",
  cancellation_agent: "Cancellation",
  expense_agent: "Expense",
};

export default function ChatWidgetHandover({
  key_id,
  item,
  messageUp,
}: ChatWidgetHandoverProps) {
  useWebSocket({
    onMessage: (data) => {
      if (messageUp && data) {
        messageUp({ type: "refresh_workspace" });
      }
    },
  });

  const handover: Handover = item?._out ?? {};
  const target = handover.target_agent ?? "unknown";
  const label = AGENT_LABELS[target] ?? target.replace(/_/g, " ");
  const handoverPayload = handover.payload ?? {};
  const request = handoverPayload.request ?? {};
  const resolved = handoverPayload.resolved_entities ?? {};
  const userGoal = request.user_goal ?? "";

  return (
    <span
      key={key_id}
      className="flex flex-col mb-4 w-full max-w-[85%] mx-auto"
    >
      <Card className="overflow-hidden border-primary/30 bg-primary/5">
        <CardHeader className="py-3 px-4 pb-2 flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ArrowRightCircle className="h-5 w-5 text-primary shrink-0" />
            <span className="text-sm font-semibold">Handover</span>
          </div>
          <Badge variant="default" className="shrink-0">
            {label} Agent
          </Badge>
        </CardHeader>
        <CardContent className="py-2 px-4 pb-4 space-y-3">
          {handover.message && (
            <p className="text-sm text-foreground">{handover.message}</p>
          )}
          {userGoal && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Goal
              </p>
              <p className="text-sm">{userGoal}</p>
            </div>
          )}
          {(resolved.traveler || resolved.trip) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {resolved.traveler && (
                <Badge variant="secondary" className="font-normal">
                  Traveler: {resolved.traveler.label ?? resolved.traveler.id ?? "—"}
                </Badge>
              )}
              {resolved.trip && (
                <Badge variant="secondary" className="font-normal">
                  Trip: {resolved.trip.label ?? resolved.trip.id ?? "—"}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </span>
  );
}
