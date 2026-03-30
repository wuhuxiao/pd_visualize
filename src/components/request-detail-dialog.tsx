"use client";

import { formatMs, formatTokens } from "@/lib/format";
import type { RequestRecord } from "@/types/simulation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RequestDetailDialogProps {
  request?: RequestRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function detailRow(label: string, value: string) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--secondary)]/40 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm">{value}</p>
    </div>
  );
}

export function RequestDetailDialog({
  request,
  open,
  onOpenChange,
}: RequestDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{request?.id ?? "Request details"}</DialogTitle>
          <DialogDescription>
            Per-request lifecycle trace with the timestamps used to compute TTFT,
            TPOT, and end-to-end latency.
          </DialogDescription>
        </DialogHeader>

        {request ? (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              {detailRow("TTFT", formatMs(request.metrics.ttftMs))}
              {detailRow("TPOT", formatMs(request.metrics.tpotMs))}
              {detailRow("E2E", formatMs(request.metrics.e2eLatencyMs))}
              {detailRow("Input", formatTokens(request.inputTokens))}
              {detailRow(
                "Output delivered",
                `${request.outputTokensDelivered}/${request.outputTokensTarget} tok`,
              )}
              {detailRow("Status", request.status)}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {detailRow("arrival_time", formatMs(request.arrivalTimeMs))}
              {detailRow(
                "prefill_start_time",
                formatMs(request.prefillStartTimeMs),
              )}
              {detailRow("prefill_end_time", formatMs(request.prefillEndTimeMs))}
              {detailRow("decode_start_time", formatMs(request.decodeStartTimeMs))}
              {detailRow("first_token_time", formatMs(request.firstTokenTimeMs))}
              {detailRow("finish_time", formatMs(request.finishTimeMs))}
            </div>

            <div className="rounded-xl border border-[color:var(--border)]">
              <div className="grid grid-cols-[120px_120px_1fr] gap-3 border-b border-[color:var(--border)] bg-[color:var(--secondary)]/50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                <span>Time</span>
                <span>Type</span>
                <span>Event</span>
              </div>
              <div className="divide-y divide-[color:var(--border)]">
                {request.timeline.map((event) => (
                  <div
                    key={`${request.id}-${event.timeMs}-${event.label}`}
                    className="grid grid-cols-[120px_120px_1fr] gap-3 px-4 py-3 text-sm"
                  >
                    <span className="font-mono">{formatMs(event.timeMs)}</span>
                    <span className="font-mono text-[color:var(--muted-foreground)]">
                      {event.type}
                    </span>
                    <div>
                      <p>{event.label}</p>
                      {event.detail ? (
                        <p className="text-xs text-[color:var(--muted-foreground)]">
                          {event.detail}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
