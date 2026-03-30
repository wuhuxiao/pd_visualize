"use client";

import { useMemo, useState } from "react";

import { formatMs } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ControllerSnapshot, RequestRecord } from "@/types/simulation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TimelinePanelProps {
  snapshot: ControllerSnapshot;
  onSelectRequest: (requestId: string) => void;
}

interface Point {
  x: number;
  y: number;
}

const PAGE_SIZE = 8;

function segmentStyle(
  startMs: number | undefined,
  endMs: number | undefined,
  durationMs: number,
) {
  if (startMs === undefined || endMs === undefined || endMs < startMs) {
    return undefined;
  }

  const left = (startMs / Math.max(durationMs, 1)) * 100;
  const width = Math.max(((endMs - startMs) / Math.max(durationMs, 1)) * 100, 0.8);
  return {
    left: `${left}%`,
    width: `${width}%`,
  };
}

function StageSegment({
  startMs,
  endMs,
  durationMs,
  className,
}: {
  startMs?: number;
  endMs?: number;
  durationMs: number;
  className: string;
}) {
  const style = segmentStyle(startMs, endMs, durationMs);
  if (!style) {
    return null;
  }

  return <div className={cn("absolute h-3 rounded-full", className)} style={style} />;
}

function connectionStyle(from: Point, to: Point) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return {
    left: `${from.x}%`,
    top: `${from.y}%`,
    width: `${length}%`,
    transform: `rotate(${angle}deg)`,
    transformOrigin: "0 50%",
  };
}

function buildNodePositions(snapshot: ControllerSnapshot) {
  const prefillNodes = snapshot.nodes.filter((node) => node.kind === "prefill");
  const decodeNodes = snapshot.nodes.filter((node) => node.kind === "decode");

  const distribute = (count: number) => {
    if (count <= 1) {
      return [50];
    }

    const start = 26;
    const end = 74;
    const step = (end - start) / Math.max(count - 1, 1);
    return Array.from({ length: count }, (_, index) => start + index * step);
  };

  const points: Record<string, Point> = {
    client: { x: 8, y: 50 },
    coordinator: { x: 28, y: 50 },
    client_return: { x: 94, y: 50 },
  };

  distribute(prefillNodes.length).forEach((y, index) => {
    points[prefillNodes[index].id] = { x: 50, y };
  });
  distribute(decodeNodes.length).forEach((y, index) => {
    points[decodeNodes[index].id] = { x: 76, y };
  });

  return { points, prefillNodes, decodeNodes };
}

function FlowBoard({ snapshot }: { snapshot: ControllerSnapshot }) {
  const { points, prefillNodes, decodeNodes } = useMemo(
    () => buildNodePositions(snapshot),
    [snapshot],
  );

  const connections = [
    { from: "client", to: "coordinator" },
    ...prefillNodes.map((node) => ({ from: "coordinator", to: node.id })),
    ...prefillNodes.flatMap((prefillNode) =>
      decodeNodes.map((decodeNode) => ({ from: prefillNode.id, to: decodeNode.id })),
    ),
    ...decodeNodes.map((node) => ({ from: node.id, to: "client_return" })),
  ];

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[linear-gradient(135deg,rgba(14,116,144,0.08),rgba(56,189,248,0.02))] p-4">
      <div className="relative h-[220px] overflow-hidden rounded-lg">
        {connections.map((connection) => {
          const from = points[connection.from];
          const to = points[connection.to];
          if (!from || !to) {
            return null;
          }

          return (
            <div
              key={`${connection.from}-${connection.to}`}
              className="absolute h-px bg-slate-300"
              style={connectionStyle(from, to)}
            />
          );
        })}

        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
          style={{ left: `${points.client.x}%`, top: `${points.client.y}%` }}
        >
          Client
        </div>
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
          style={{ left: `${points.coordinator.x}%`, top: `${points.coordinator.y}%` }}
        >
          Coordinator
        </div>
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
          style={{ left: `${points.client_return.x}%`, top: `${points.client_return.y}%` }}
        >
          Client
        </div>

        {prefillNodes.map((node) => (
          <div
            key={node.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border border-amber-200 bg-amber-500 px-3 py-2 text-xs font-semibold text-white shadow-sm"
            style={{ left: `${points[node.id].x}%`, top: `${points[node.id].y}%` }}
          >
            <p>{node.id}</p>
            <p className="mt-0.5 text-[10px] text-amber-50">
              batch {node.activeBatchSize} | q {node.queueLength}
            </p>
          </div>
        ))}

        {decodeNodes.map((node) => (
          <div
            key={node.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border border-sky-200 bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm"
            style={{ left: `${points[node.id].x}%`, top: `${points[node.id].y}%` }}
          >
            <p>{node.id}</p>
            <p className="mt-0.5 text-[10px] text-sky-50">
              batch {node.activeBatchSize} | q {node.queueLength}
            </p>
          </div>
        ))}

        {snapshot.activeTransfers.map((transfer) => {
          const fromKey = transfer.from === "client" ? "client" : transfer.from;
          const toKey = transfer.to === "client" ? "client_return" : transfer.to;
          const from = points[fromKey];
          const to = points[toKey];
          if (!from || !to) {
            return null;
          }

          const x = from.x + (to.x - from.x) * transfer.progress;
          const y = from.y + (to.y - from.y) * transfer.progress;

          return (
            <div
              key={transfer.id}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-[10px] font-semibold text-white shadow-sm",
                transfer.kind === "token" ? "bg-emerald-500" : "bg-slate-700",
              )}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {transfer.requestId}
              {transfer.kind === "token" ? ` +${transfer.tokenCount}` : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RequestRow({
  request,
  durationMs,
  currentTimeMs,
  onSelect,
}: {
  request: RequestRecord;
  durationMs: number;
  currentTimeMs: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="grid w-full grid-cols-[90px_1fr_110px] items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-left transition hover:border-[color:var(--border)] hover:bg-[color:var(--secondary)]/50"
    >
      <div>
        <p className="font-mono text-sm font-semibold">{request.id}</p>
        <p className="text-xs text-[color:var(--muted-foreground)]">{request.status}</p>
      </div>

      <div className="relative h-10 rounded-lg bg-[color:var(--secondary)]/50">
        <StageSegment
          startMs={request.arrivalTimeMs}
          endMs={request.coordinatorArrivalTimeMs}
          durationMs={durationMs}
          className="top-2 bg-slate-400"
        />
        <StageSegment
          startMs={request.prefillQueueEnterTimeMs}
          endMs={request.prefillStartTimeMs}
          durationMs={durationMs}
          className="top-2 bg-amber-200"
        />
        <StageSegment
          startMs={request.prefillStartTimeMs}
          endMs={request.prefillEndTimeMs}
          durationMs={durationMs}
          className="top-2 bg-amber-500"
        />
        <StageSegment
          startMs={request.prefillEndTimeMs}
          endMs={request.decodeQueueEnterTimeMs}
          durationMs={durationMs}
          className="top-2 bg-sky-300"
        />
        <StageSegment
          startMs={request.decodeQueueEnterTimeMs}
          endMs={request.decodeStartTimeMs}
          durationMs={durationMs}
          className="top-5 bg-violet-200"
        />
        <StageSegment
          startMs={request.decodeStartTimeMs}
          endMs={request.finishTimeMs ?? currentTimeMs}
          durationMs={durationMs}
          className="top-5 bg-sky-600"
        />
        <StageSegment
          startMs={request.firstTokenTimeMs}
          endMs={request.finishTimeMs ?? request.lastTokenTimeMs}
          durationMs={durationMs}
          className="top-8 h-1.5 bg-emerald-500"
        />
        <div
          className="absolute inset-y-0 w-px bg-[color:var(--accent-strong)]"
          style={{ left: `${(currentTimeMs / Math.max(durationMs, 1)) * 100}%` }}
        />
      </div>

      <div className="space-y-1 text-right">
        <p className="font-mono text-xs">
          TTFT{" "}
          {request.metrics.ttftMs !== undefined
            ? formatMs(request.metrics.ttftMs)
            : "pending"}
        </p>
        <p className="font-mono text-xs">
          E2E{" "}
          {request.metrics.e2eLatencyMs !== undefined
            ? formatMs(request.metrics.e2eLatencyMs)
            : "pending"}
        </p>
      </div>
    </button>
  );
}

export function TimelinePanel({ snapshot, onSelectRequest }: TimelinePanelProps) {
  const [page, setPage] = useState(1);
  const reversedRequests = useMemo(
    () => [...snapshot.requests].reverse(),
    [snapshot.requests],
  );
  const totalPages = Math.max(Math.ceil(reversedRequests.length / PAGE_SIZE), 1);
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const visibleRequests = reversedRequests.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Flow & Timeline</CardTitle>
        <CardDescription>
          The upper board animates traffic across concrete P and D instances. The
          lower list paginates every request lifecycle in the simulation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FlowBoard snapshot={snapshot} />

        <div className="rounded-xl border border-[color:var(--border)]">
          <div className="flex flex-col gap-3 border-b border-[color:var(--border)] px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold">Request Lifecycles</p>
              <p className="text-xs text-[color:var(--muted-foreground)]">
                Amber = prefill, blue = decode, green = client-visible stream
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="info">
                page {safePage}/{totalPages}
              </Badge>
              <Badge variant="default">{snapshot.requests.length} total requests</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(Math.max(safePage - 1, 1))}
                disabled={safePage <= 1}
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(Math.min(safePage + 1, totalPages))}
                disabled={safePage >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
          <div className="max-h-[420px] space-y-1 overflow-y-auto p-2">
            {visibleRequests.map((request) => (
              <RequestRow
                key={request.id}
                request={request}
                durationMs={snapshot.durationMs}
                currentTimeMs={snapshot.currentTimeMs}
                onSelect={() => onSelectRequest(request.id)}
              />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[color:var(--border)]">
          <div className="border-b border-[color:var(--border)] px-4 py-3">
            <p className="text-sm font-semibold">Event Feed</p>
          </div>
          <div className="max-h-[180px] divide-y divide-[color:var(--border)] overflow-y-auto">
            {snapshot.systemEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
              >
                <div>
                  <p>{event.label}</p>
                  <p className="text-xs text-[color:var(--muted-foreground)]">
                    {event.requestId ?? "system"}
                    {event.nodeId ? ` | ${event.nodeId}` : ""}
                  </p>
                </div>
                <span className="font-mono text-xs text-[color:var(--muted-foreground)]">
                  {formatMs(event.timeMs)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
