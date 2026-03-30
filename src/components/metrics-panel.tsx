"use client";

import { useState, useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMs, formatThroughput, formatTokens } from "@/lib/format";
import { round } from "@/lib/utils";
import type { ControllerSnapshot } from "@/types/simulation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const subscribeNoop = () => () => undefined;
const getClientMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

interface MetricsPanelProps {
  snapshot: ControllerSnapshot;
  chartMode: "realtime" | "final";
  onChartModeChange: (mode: "realtime" | "final") => void;
}

function NodeFilter({
  title,
  nodeIds,
  selectedNodeIds,
  onToggle,
}: {
  title: string;
  nodeIds: string[];
  selectedNodeIds: string[];
  onToggle: (nodeId: string) => void;
}) {
  if (nodeIds.length <= 1) {
    return null;
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {title}
      </span>
      {nodeIds.map((nodeId) => (
        <Button
          key={nodeId}
          size="sm"
          variant={selectedNodeIds.includes(nodeId) ? "default" : "outline"}
          onClick={() => onToggle(nodeId)}
        >
          {nodeId}
        </Button>
      ))}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-white/70 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
        {title}
      </p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">{hint}</p>
    </div>
  );
}

function PercentileTable({ snapshot }: { snapshot: ControllerSnapshot }) {
  const rows = [
    {
      label: "avg",
      ttft: snapshot.metrics.ttft.avg,
      tpot: snapshot.metrics.tpot.avg,
      e2e: snapshot.metrics.e2eLatency.avg,
    },
    {
      label: "p50",
      ttft: snapshot.metrics.ttft.p50,
      tpot: snapshot.metrics.tpot.p50,
      e2e: snapshot.metrics.e2eLatency.p50,
    },
    {
      label: "p90",
      ttft: snapshot.metrics.ttft.p90,
      tpot: snapshot.metrics.tpot.p90,
      e2e: snapshot.metrics.e2eLatency.p90,
    },
    {
      label: "p99",
      ttft: snapshot.metrics.ttft.p99,
      tpot: snapshot.metrics.tpot.p99,
      e2e: snapshot.metrics.e2eLatency.p99,
    },
    {
      label: "max",
      ttft: snapshot.metrics.ttft.max,
      tpot: snapshot.metrics.tpot.max,
      e2e: snapshot.metrics.e2eLatency.max,
    },
  ];

  return (
    <div className="rounded-xl border border-[color:var(--border)]">
      <div className="grid grid-cols-4 border-b border-[color:var(--border)] bg-[color:var(--secondary)]/50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
        <span>Metric</span>
        <span>TTFT</span>
        <span>TPOT</span>
        <span>E2E</span>
      </div>
      <div className="divide-y divide-[color:var(--border)]">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-4 px-4 py-3 text-sm">
            <span className="font-mono uppercase text-[color:var(--muted-foreground)]">
              {row.label}
            </span>
            <span className="font-mono">{formatMs(row.ttft)}</span>
            <span className="font-mono">{formatMs(row.tpot)}</span>
            <span className="font-mono">{formatMs(row.e2e)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MetricsPanel({
  snapshot,
  chartMode,
  onChartModeChange,
}: MetricsPanelProps) {
  const mounted = useSyncExternalStore(
    subscribeNoop,
    getClientMountedSnapshot,
    getServerMountedSnapshot,
  );
  const [decodeFilter, setDecodeFilter] = useState<string[]>([]);
  const [prefillFilter, setPrefillFilter] = useState<string[]>([]);

  const throughputData =
    chartMode === "realtime"
      ? snapshot.realtimeSeries.map((point) => ({
          time: round(point.timeMs / 1000, 2),
          inputThroughput: point.inputThroughput,
          outputThroughput: point.outputThroughput,
          requestThroughput: point.requestThroughput,
        }))
      : snapshot.finalSeries.map((point) => ({
          time: point.second,
          inputThroughput: point.inputThroughput,
          outputThroughput: point.outputThroughput,
          requestThroughput: point.requestThroughput,
        }));

  const queueData =
    chartMode === "realtime"
      ? snapshot.realtimeQueueSeries.map((point) => ({
          ...point,
          time: round(point.timeMs / 1000, 2),
        }))
      : snapshot.finalQueueSeries.map((point) => ({
          ...point,
          time: round(point.timeMs / 1000, 2),
        }));
  const batchData =
    chartMode === "realtime"
      ? snapshot.realtimeBatchSeries.map((point) => ({
          ...point,
          time: round(point.timeMs / 1000, 2),
        }))
      : snapshot.finalBatchSeries.map((point) => ({
          ...point,
          time: round(point.timeMs / 1000, 2),
        }));

  const queueKeys = Object.keys(queueData[0] ?? {}).filter(
    (key) => key !== "timeMs" && key !== "time",
  );
  const prefillNodeIds = snapshot.nodes
    .filter((node) => node.kind === "prefill")
    .map((node) => node.id);
  const decodeNodeIds = snapshot.nodes
    .filter((node) => node.kind === "decode")
    .map((node) => node.id);
  const selectedDecodeNodeIds =
    decodeFilter.filter((nodeId) => decodeNodeIds.includes(nodeId)).length > 0
      ? decodeFilter.filter((nodeId) => decodeNodeIds.includes(nodeId))
      : decodeNodeIds;
  const selectedPrefillNodeIds =
    prefillFilter.filter((nodeId) => prefillNodeIds.includes(nodeId)).length > 0
      ? prefillFilter.filter((nodeId) => prefillNodeIds.includes(nodeId))
      : prefillNodeIds;
  const ttftData = snapshot.ttftSeries
    .filter((point) => point.ttftMs !== undefined)
    .map((point) => ({
      request: point.requestId,
      ttftMs: point.ttftMs,
    }));
  const tpotData = snapshot.tpotSeries
    .filter((point) => point.tpotMs !== undefined)
    .map((point) => ({
      request: point.requestId,
      tpotMs: point.tpotMs,
    }));

  const chartFallback = (
    <div className="flex h-72 items-center justify-center rounded-lg bg-[color:var(--secondary)]/40 text-sm text-[color:var(--muted-foreground)]">
      Chart mounts on the client to avoid coupling rendering with viewport size.
    </div>
  );

  const prefillCombinedData = Array.from(
    new Set([...queueData.map((point) => point.time), ...batchData.map((point) => point.time)]),
  )
    .sort((a, b) => Number(a) - Number(b))
    .map((time) => {
      const queuePoint = (queueData.find((point) => point.time === time) ?? {
        time,
      }) as Record<string, number | string>;
      const batchPoint = (batchData.find((point) => point.time === time) ?? {
        time,
      }) as Record<string, number | string>;
      const combined: Record<string, number | string> = { time };

      for (const nodeId of prefillNodeIds) {
        combined[`${nodeId}_queue`] = Number(queuePoint[nodeId] ?? 0);
        combined[`${nodeId}_batch`] = Number(batchPoint[nodeId] ?? 0);
      }

      return combined;
    });
  const decodeBatchChartData = batchData.map((point) => {
    const batchPoint = point as Record<string, number | string>;
    const normalized: Record<string, number | string> = {
      time: point.time,
    };
    for (const nodeId of selectedDecodeNodeIds) {
      normalized[nodeId] = Number(batchPoint[nodeId] ?? 0);
    }
    return normalized;
  });
  const toggleDecodeNode = (nodeId: string) => {
    setDecodeFilter((current) => {
      const base =
        current.filter((id) => decodeNodeIds.includes(id)).length > 0
          ? current.filter((id) => decodeNodeIds.includes(id))
          : decodeNodeIds;

      if (base.includes(nodeId)) {
        if (base.length === 1) {
          return base;
        }
        return base.filter((id) => id !== nodeId);
      }

      return [...base, nodeId];
    });
  };
  const togglePrefillNode = (nodeId: string) => {
    setPrefillFilter((current) => {
      const base =
        current.filter((id) => prefillNodeIds.includes(id)).length > 0
          ? current.filter((id) => prefillNodeIds.includes(id))
          : prefillNodeIds;

      if (base.includes(nodeId)) {
        if (base.length === 1) {
          return base;
        }
        return base.filter((id) => id !== nodeId);
      }

      return [...base, nodeId];
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          title="Completed"
          value={`${snapshot.metrics.completedRequests}/${snapshot.metrics.totalRequests}`}
          hint="requests completed during current horizon"
        />
        <SummaryCard
          title="Input Throughput"
          value={formatThroughput(snapshot.metrics.systemInputThroughput, "tok/s")}
          hint={formatTokens(snapshot.metrics.totalInputTokens)}
        />
        <SummaryCard
          title="Output Throughput"
          value={formatThroughput(snapshot.metrics.systemOutputThroughput, "tok/s")}
          hint={formatTokens(snapshot.metrics.totalOutputTokens)}
        />
        <SummaryCard
          title="Request Throughput"
          value={formatThroughput(snapshot.metrics.requestThroughput, "req/s")}
          hint="completed requests per simulated second"
        />
        <SummaryCard
          title="Avg TTFT"
          value={formatMs(snapshot.metrics.ttft.avg)}
          hint={`p90 ${formatMs(snapshot.metrics.ttft.p90)}`}
        />
        <SummaryCard
          title="Avg E2E"
          value={formatMs(snapshot.metrics.e2eLatency.avg)}
          hint={`p99 ${formatMs(snapshot.metrics.e2eLatency.p99)}`}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>Metrics & Charts</CardTitle>
          <Tabs value={chartMode} onValueChange={(value) => onChartModeChange(value as "realtime" | "final")}>
            <TabsList>
              <TabsTrigger value="realtime">Realtime Mode</TabsTrigger>
              <TabsTrigger value="final">Final Mode</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-[color:var(--border)] p-3">
              <p className="mb-3 text-sm font-semibold">TTFT by Request</p>
              <div className="h-72 min-w-0">
                {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ttftData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                    <XAxis dataKey="request" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="ttftMs" fill="#0f766e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                ) : chartFallback}
              </div>
            </div>

            <div className="rounded-xl border border-[color:var(--border)] p-3">
              <p className="mb-3 text-sm font-semibold">TPOT by Request</p>
              <div className="h-72 min-w-0">
                {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tpotData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                    <XAxis dataKey="request" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="tpotMs" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                ) : chartFallback}
              </div>
            </div>

            <div className="rounded-xl border border-[color:var(--border)] p-3">
              <p className="mb-3 text-sm font-semibold">Throughput</p>
              <div className="h-72 min-w-0">
                {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={throughputData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                    <XAxis dataKey="time" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="inputThroughput" stroke="#f59e0b" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="outputThroughput" stroke="#0ea5e9" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="requestThroughput" stroke="#10b981" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
                ) : chartFallback}
              </div>
            </div>

            <div className="rounded-xl border border-[color:var(--border)] p-3">
              <p className="mb-3 text-sm font-semibold">Queue Length</p>
              <div className="h-72 min-w-0">
                {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={queueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                    <XAxis dataKey="time" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Legend />
                    {queueKeys.map((key, index) => (
                      <Line
                        key={key}
                        type="stepAfter"
                        dataKey={key}
                        stroke={["#f59e0b", "#0ea5e9", "#8b5cf6", "#10b981"][index % 4]}
                        dot={false}
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                ) : chartFallback}
              </div>
            </div>

            <div className="rounded-xl border border-[color:var(--border)] p-3">
              <p className="mb-3 text-sm font-semibold">Decode Active Batch Over Time</p>
              <NodeFilter
                title="Decode nodes"
                nodeIds={decodeNodeIds}
                selectedNodeIds={selectedDecodeNodeIds}
                onToggle={toggleDecodeNode}
              />
              <div className="h-72 min-w-0">
                {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={decodeBatchChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                    <XAxis dataKey="time" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Legend />
                    {selectedDecodeNodeIds.map((nodeId, index) => (
                      <Line
                        key={nodeId}
                        type="stepAfter"
                        dataKey={nodeId}
                        stroke={["#0ea5e9", "#2563eb", "#8b5cf6", "#14b8a6"][index % 4]}
                        dot={false}
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                ) : chartFallback}
              </div>
            </div>

            <div className="rounded-xl border border-[color:var(--border)] p-3">
              <p className="mb-3 text-sm font-semibold">
                Prefill Queue + Active Batch Over Time
              </p>
              <NodeFilter
                title="Prefill nodes"
                nodeIds={prefillNodeIds}
                selectedNodeIds={selectedPrefillNodeIds}
                onToggle={togglePrefillNode}
              />
              <div className="h-72 min-w-0">
                {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={prefillCombinedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                    <XAxis dataKey="time" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Legend />
                    {selectedPrefillNodeIds.map((nodeId, index) => (
                      <Line
                        key={`${nodeId}_queue`}
                        type="stepAfter"
                        dataKey={`${nodeId}_queue`}
                        name={`${nodeId} queue`}
                        stroke={["#f59e0b", "#d97706", "#b45309", "#92400e"][index % 4]}
                        dot={false}
                        strokeWidth={2}
                      />
                    ))}
                    {selectedPrefillNodeIds.map((nodeId, index) => (
                      <Line
                        key={`${nodeId}_batch`}
                        type="stepAfter"
                        dataKey={`${nodeId}_batch`}
                        name={`${nodeId} active batch`}
                        stroke={["#10b981", "#059669", "#0d9488", "#0f766e"][index % 4]}
                        dot={false}
                        strokeDasharray="6 4"
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                ) : chartFallback}
              </div>
            </div>
          </div>

          <PercentileTable snapshot={snapshot} />
        </CardContent>
      </Card>
    </div>
  );
}
