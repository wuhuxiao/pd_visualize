"use client";

import { formatMs, formatThroughput, formatTokens } from "@/lib/format";
import {
  type UiLocale,
  translateRequestEventType,
  translateRequestStatus,
} from "@/lib/i18n";
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
  locale: UiLocale;
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
  locale,
  open,
  onOpenChange,
}: RequestDetailDialogProps) {
  const zh = locale === "zh-CN";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{request?.id ?? (zh ? "请求详情" : "Request details")}</DialogTitle>
          <DialogDescription>
            {zh
              ? "单个请求的生命周期追踪，以及用于计算 TTFT、TPOT 和端到端时延的关键时间戳。"
              : "Per-request lifecycle trace with the timestamps used to compute TTFT, TPOT, and end-to-end latency."}
          </DialogDescription>
        </DialogHeader>

        {request ? (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              {detailRow("TTFT", formatMs(request.metrics.ttftMs))}
              {detailRow("TPOT", formatMs(request.metrics.tpotMs))}
              {detailRow("E2EL", formatMs(request.metrics.e2eLatencyMs))}
              {detailRow(
                zh ? "输出 Token 吞吐" : "OutputTokenThroughput",
                request.metrics.outputTokenThroughputTokPerSec !== undefined
                  ? formatThroughput(
                      request.metrics.outputTokenThroughputTokPerSec,
                      "tok/s",
                    )
                  : "N/A",
              )}
              {detailRow(zh ? "输入" : "Input", formatTokens(request.inputTokens))}
              {detailRow(
                zh ? "已返回输出" : "Output delivered",
                `${request.outputTokensDelivered}/${request.outputTokensTarget} ${
                  zh ? "tok" : "tok"
                }`,
              )}
              {detailRow(
                zh ? "状态" : "Status",
                translateRequestStatus(request.status, locale),
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {detailRow(zh ? "到达时间" : "arrival_time", formatMs(request.arrivalTimeMs))}
              {detailRow(
                zh ? "prefill 开始时间" : "prefill_start_time",
                formatMs(request.prefillStartTimeMs),
              )}
              {detailRow(
                zh ? "prefill 结束时间" : "prefill_end_time",
                formatMs(request.prefillEndTimeMs),
              )}
              {detailRow(
                zh ? "decode 开始时间" : "decode_start_time",
                formatMs(request.decodeStartTimeMs),
              )}
              {detailRow(
                zh ? "首个 token 时间" : "first_token_time",
                formatMs(request.firstTokenTimeMs),
              )}
              {detailRow(zh ? "完成时间" : "finish_time", formatMs(request.finishTimeMs))}
            </div>

            <div className="rounded-xl border border-[color:var(--border)]">
              <div className="grid grid-cols-[120px_120px_1fr] gap-3 border-b border-[color:var(--border)] bg-[color:var(--secondary)]/50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                <span>{zh ? "时间" : "Time"}</span>
                <span>{zh ? "类型" : "Type"}</span>
                <span>{zh ? "事件" : "Event"}</span>
              </div>
              <div className="divide-y divide-[color:var(--border)]">
                {request.timeline.map((event) => (
                  <div
                    key={`${request.id}-${event.timeMs}-${event.label}`}
                    className="grid grid-cols-[120px_120px_1fr] gap-3 px-4 py-3 text-sm"
                  >
                    <span className="font-mono">{formatMs(event.timeMs)}</span>
                    <span className="font-mono text-[color:var(--muted-foreground)]">
                      {translateRequestEventType(event.type, locale)}
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
