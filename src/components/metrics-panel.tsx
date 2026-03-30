"use client";

import { useState, useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMs, formatThroughput, formatTokens } from "@/lib/format";
import { type UiLocale } from "@/lib/i18n";
import { round } from "@/lib/utils";
import type { ControllerSnapshot } from "@/types/simulation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const subscribeNoop = () => () => undefined;
const getClientMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;
const MAX_REALTIME_CHART_POINTS = 240;
const MAX_FINAL_CHART_POINTS = 180;

function downsampleSeries<T>(series: T[], maxPoints: number) {
  if (series.length <= maxPoints) {
    return series;
  }

  const sampled: T[] = [];
  const step = (series.length - 1) / (maxPoints - 1);

  for (let index = 0; index < maxPoints; index += 1) {
    sampled.push(series[Math.round(index * step)]);
  }

  return sampled;
}

interface MetricsPanelProps {
  snapshot: ControllerSnapshot;
  locale: UiLocale;
  chartMode: "realtime" | "final";
  onChartModeChange: (mode: "realtime" | "final") => void;
}

interface SeriesControlItem {
  key: string;
  label: string;
  color: string;
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

function SeriesLegendControl({
  title,
  items,
  selectedKeys,
  onToggle,
}: {
  title: string;
  items: SeriesControlItem[];
  selectedKeys: string[];
  onToggle: (key: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {title}
      </span>
      {items.map((item) => {
        const active = selectedKeys.includes(item.key);
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onToggle(item.key)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition ${
              active
                ? "border-[color:var(--accent-strong)] bg-[color:var(--accent)]/10 text-[color:var(--foreground)]"
                : "border-[color:var(--border)] text-[color:var(--muted-foreground)]"
            }`}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </button>
        );
      })}
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

function PercentileTable({
  snapshot,
  locale,
}: {
  snapshot: ControllerSnapshot;
  locale: UiLocale;
}) {
  const zh = locale === "zh-CN";
  const rows = [
    {
      label: "avg",
      ttft: snapshot.metrics.ttft.avg,
      tpot: snapshot.metrics.tpot.avg,
      e2e: snapshot.metrics.e2eLatency.avg,
      outputTokenThroughput: snapshot.metrics.outputTokenThroughput.avg,
    },
    {
      label: "p50",
      ttft: snapshot.metrics.ttft.p50,
      tpot: snapshot.metrics.tpot.p50,
      e2e: snapshot.metrics.e2eLatency.p50,
      outputTokenThroughput: snapshot.metrics.outputTokenThroughput.p50,
    },
    {
      label: "p90",
      ttft: snapshot.metrics.ttft.p90,
      tpot: snapshot.metrics.tpot.p90,
      e2e: snapshot.metrics.e2eLatency.p90,
      outputTokenThroughput: snapshot.metrics.outputTokenThroughput.p90,
    },
    {
      label: "p99",
      ttft: snapshot.metrics.ttft.p99,
      tpot: snapshot.metrics.tpot.p99,
      e2e: snapshot.metrics.e2eLatency.p99,
      outputTokenThroughput: snapshot.metrics.outputTokenThroughput.p99,
    },
    {
      label: "max",
      ttft: snapshot.metrics.ttft.max,
      tpot: snapshot.metrics.tpot.max,
      e2e: snapshot.metrics.e2eLatency.max,
      outputTokenThroughput: snapshot.metrics.outputTokenThroughput.max,
    },
  ];

  return (
    <div className="rounded-xl border border-[color:var(--border)]">
      <div className="grid grid-cols-5 border-b border-[color:var(--border)] bg-[color:var(--secondary)]/50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
        <span>{zh ? "指标" : "Metric"}</span>
        <span>TTFT</span>
        <span>TPOT</span>
        <span>E2EL</span>
        <span>OutTok/s</span>
      </div>
      <div className="divide-y divide-[color:var(--border)]">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-5 px-4 py-3 text-sm">
            <span className="font-mono uppercase text-[color:var(--muted-foreground)]">
              {row.label}
            </span>
            <span className="font-mono">{formatMs(row.ttft)}</span>
            <span className="font-mono">{formatMs(row.tpot)}</span>
            <span className="font-mono">{formatMs(row.e2e)}</span>
            <span className="font-mono">
              {formatThroughput(row.outputTokenThroughput, "tok/s")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommonMetricTable({
  snapshot,
  locale,
}: {
  snapshot: ControllerSnapshot;
  locale: UiLocale;
}) {
  const zh = locale === "zh-CN";
  const rows = [
    {
      label: zh ? "压测时长" : "Benchmark Duration",
      value: formatMs(snapshot.metrics.benchmarkDurationMs),
    },
    {
      label: zh ? "总请求数" : "Total Requests",
      value: `${snapshot.metrics.totalRequests}`,
    },
    {
      label: zh ? "未完成请求数" : "Failed Requests",
      value: `${snapshot.metrics.failedRequests}`,
    },
    {
      label: zh ? "成功请求数" : "Success Requests",
      value: `${snapshot.metrics.completedRequests}`,
    },
    {
      label: zh ? "并发度" : "Concurrency",
      value: round(snapshot.metrics.concurrency, 2).toString(),
    },
    {
      label: zh ? "最大并发" : "Max Concurrency",
      value: `${snapshot.metrics.maxConcurrency}`,
    },
    {
      label: zh ? "请求吞吐" : "Request Throughput",
      value: formatThroughput(snapshot.metrics.requestThroughput, "req/s"),
    },
    {
      label: zh ? "总输入 Token" : "Total Input Tokens",
      value: formatTokens(snapshot.metrics.totalInputTokens),
    },
    {
      label: zh ? "Prefill Token 吞吐" : "Prefill Token Throughput",
      value: formatThroughput(snapshot.metrics.prefillTokenThroughput, "tok/s"),
    },
    {
      label: zh ? "总输出 Token" : "Total Output Tokens",
      value: formatTokens(snapshot.metrics.totalOutputTokens),
    },
    {
      label: zh ? "输入 Token 吞吐" : "Input Token Throughput",
      value: formatThroughput(snapshot.metrics.systemInputThroughput, "tok/s"),
    },
    {
      label: zh ? "输出 Token 吞吐" : "Output Token Throughput",
      value: formatThroughput(snapshot.metrics.systemOutputThroughput, "tok/s"),
    },
    {
      label: zh ? "总 Token 吞吐" : "Total Token Throughput",
      value: formatThroughput(snapshot.metrics.totalTokenThroughput, "tok/s"),
    },
  ];

  return (
    <div className="rounded-xl border border-[color:var(--border)]">
      <div className="grid grid-cols-[1.5fr_1fr] border-b border-[color:var(--border)] bg-[color:var(--secondary)]/50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
        <span>{zh ? "通用指标" : "Common Metric"}</span>
        <span>{zh ? "值" : "Value"}</span>
      </div>
      <div className="divide-y divide-[color:var(--border)]">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[1.5fr_1fr] gap-3 px-4 py-3 text-sm"
          >
            <span>{row.label}</span>
            <span className="font-mono">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MetricsPanel({
  snapshot,
  locale,
  chartMode,
  onChartModeChange,
}: MetricsPanelProps) {
  const zh = locale === "zh-CN";
  const mounted = useSyncExternalStore(
    subscribeNoop,
    getClientMountedSnapshot,
    getServerMountedSnapshot,
  );
  const [decodeFilter, setDecodeFilter] = useState<string[]>([]);
  const [prefillFilter, setPrefillFilter] = useState<string[]>([]);
  const [ttftSeriesFilter, setTtftSeriesFilter] = useState<string[]>(["ttftMs"]);
  const [tpotSeriesFilter, setTpotSeriesFilter] = useState<string[]>(["tpotMs"]);
  const [outputTokenSeriesFilter, setOutputTokenSeriesFilter] = useState<string[]>([
    "outputTokenThroughputTokPerSec",
  ]);
  const [throughputSeriesFilter, setThroughputSeriesFilter] = useState<string[]>([
    "prefillTokenThroughput",
    "inputThroughput",
    "outputThroughput",
    "totalTokenThroughput",
    "requestThroughput",
  ]);
  const [queueSeriesFilter, setQueueSeriesFilter] = useState<string[]>([]);
  const [decodeSeriesFilter, setDecodeSeriesFilter] = useState<string[]>([]);
  const [prefillSeriesFilter, setPrefillSeriesFilter] = useState<string[]>([]);
  const sampledRealtimeSeries = downsampleSeries(
    snapshot.realtimeSeries,
    MAX_REALTIME_CHART_POINTS,
  );
  const sampledFinalSeries = downsampleSeries(
    snapshot.finalSeries,
    MAX_FINAL_CHART_POINTS,
  );
  const sampledRealtimeQueueSeries = downsampleSeries(
    snapshot.realtimeQueueSeries,
    MAX_REALTIME_CHART_POINTS,
  );
  const sampledFinalQueueSeries = downsampleSeries(
    snapshot.finalQueueSeries,
    MAX_FINAL_CHART_POINTS,
  );
  const sampledRealtimeBatchSeries = downsampleSeries(
    snapshot.realtimeBatchSeries,
    MAX_REALTIME_CHART_POINTS,
  );
  const sampledFinalBatchSeries = downsampleSeries(
    snapshot.finalBatchSeries,
    MAX_FINAL_CHART_POINTS,
  );

  const throughputData =
    chartMode === "realtime"
      ? sampledRealtimeSeries.map((point) => ({
          time: round(point.timeMs / 1000, 2),
          inputThroughput: point.inputThroughput,
          prefillTokenThroughput: point.prefillTokenThroughput,
          outputThroughput: point.outputThroughput,
          totalTokenThroughput: point.totalTokenThroughput,
          requestThroughput: point.requestThroughput,
        }))
      : sampledFinalSeries.map((point) => ({
          time: point.second,
          inputThroughput: point.inputThroughput,
          prefillTokenThroughput: point.prefillTokenThroughput,
          outputThroughput: point.outputThroughput,
          totalTokenThroughput: point.totalTokenThroughput,
          requestThroughput: point.requestThroughput,
        }));

  const queueData =
    chartMode === "realtime"
      ? sampledRealtimeQueueSeries.map((point) => ({
          ...point,
          time: round(point.timeMs / 1000, 2),
        }))
      : sampledFinalQueueSeries.map((point) => ({
          ...point,
          time: round(point.timeMs / 1000, 2),
        }));
  const batchData =
    chartMode === "realtime"
      ? sampledRealtimeBatchSeries.map((point) => ({
          ...point,
          time: round(point.timeMs / 1000, 2),
        }))
      : sampledFinalBatchSeries.map((point) => ({
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
  const throughputSeries: SeriesControlItem[] = [
    {
      key: "prefillTokenThroughput",
      label: zh ? "Prefill Tok/s" : "Prefill Tok/s",
      color: "#a16207",
    },
    {
      key: "inputThroughput",
      label: zh ? "Input Tok/s" : "Input Tok/s",
      color: "#f59e0b",
    },
    {
      key: "outputThroughput",
      label: zh ? "Output Tok/s" : "Output Tok/s",
      color: "#0ea5e9",
    },
    {
      key: "totalTokenThroughput",
      label: zh ? "Total Tok/s" : "Total Tok/s",
      color: "#7c3aed",
    },
    {
      key: "requestThroughput",
      label: zh ? "Req/s" : "Req/s",
      color: "#10b981",
    },
  ];
  const visibleThroughputKeys =
    throughputSeriesFilter.filter((key) =>
      throughputSeries.some((item) => item.key === key),
    ).length > 0
      ? throughputSeriesFilter.filter((key) =>
          throughputSeries.some((item) => item.key === key),
        )
      : throughputSeries.map((item) => item.key);
  const queueSeriesItems: SeriesControlItem[] = queueKeys.map((key, index) => ({
    key,
    label: key,
    color: ["#f59e0b", "#0ea5e9", "#8b5cf6", "#10b981"][index % 4],
  }));
  const visibleQueueKeys =
    queueSeriesFilter.filter((key) => queueKeys.includes(key)).length > 0
      ? queueSeriesFilter.filter((key) => queueKeys.includes(key))
      : queueKeys;
  const ttftSeriesItems: SeriesControlItem[] = [
    { key: "ttftMs", label: "TTFT", color: "#0f766e" },
  ];
  const visibleTtftKeys =
    ttftSeriesFilter.includes("ttftMs") || ttftSeriesFilter.length === 0
      ? ["ttftMs"]
      : [];
  const tpotSeriesItems: SeriesControlItem[] = [
    { key: "tpotMs", label: "TPOT", color: "#2563eb" },
  ];
  const visibleTpotKeys =
    tpotSeriesFilter.includes("tpotMs") || tpotSeriesFilter.length === 0
      ? ["tpotMs"]
      : [];
  const outputTokenSeriesItems: SeriesControlItem[] = [
    {
      key: "outputTokenThroughputTokPerSec",
      label: zh ? "OutTok/s" : "OutTok/s",
      color: "#7c3aed",
    },
  ];
  const visibleOutputTokenKeys =
    outputTokenSeriesFilter.includes("outputTokenThroughputTokPerSec") ||
    outputTokenSeriesFilter.length === 0
      ? ["outputTokenThroughputTokPerSec"]
      : [];
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
  const outputTokenThroughputData = snapshot.ttftSeries
    .filter((point) => point.outputTokenThroughputTokPerSec !== undefined)
    .map((point) => ({
      request: point.requestId,
      outputTokenThroughputTokPerSec: point.outputTokenThroughputTokPerSec,
    }));

  const chartFallback = (
    <div className="flex h-72 items-center justify-center rounded-lg bg-[color:var(--secondary)]/40 text-sm text-[color:var(--muted-foreground)]">
      {zh
        ? "图表仅在客户端挂载，避免渲染过程与视口尺寸耦合。"
        : "Chart mounts on the client to avoid coupling rendering with viewport size."}
    </div>
  );

  const queueByTime = new Map<number | string, Record<string, number | string>>();
  const batchByTime = new Map<number | string, Record<string, number | string>>();

  for (const point of queueData as Array<Record<string, number | string>>) {
    queueByTime.set(point.time, point);
  }
  for (const point of batchData as Array<Record<string, number | string>>) {
    batchByTime.set(point.time, point);
  }

  const prefillCombinedData = Array.from(
    new Set([...queueByTime.keys(), ...batchByTime.keys()]),
  )
    .sort((a, b) => Number(a) - Number(b))
    .map((time) => {
      const queuePoint = queueByTime.get(time) ?? { time };
      const batchPoint = batchByTime.get(time) ?? { time };
      const combined: Record<string, number | string> = { time };

      for (const nodeId of prefillNodeIds) {
        combined[`${nodeId}_queue`] = Number(queuePoint[nodeId] ?? 0);
        combined[`${nodeId}_batch`] = Number(batchPoint[nodeId] ?? 0);
      }

      return combined;
    });
  const decodeSeriesItems: SeriesControlItem[] = selectedDecodeNodeIds.map(
    (nodeId, index) => ({
      key: nodeId,
      label: nodeId,
      color: ["#0ea5e9", "#2563eb", "#8b5cf6", "#14b8a6"][index % 4],
    }),
  );
  const visibleDecodeKeys =
    decodeSeriesFilter.filter((key) =>
      selectedDecodeNodeIds.includes(key),
    ).length > 0
      ? decodeSeriesFilter.filter((key) => selectedDecodeNodeIds.includes(key))
      : selectedDecodeNodeIds;
  const prefillSeriesItems: SeriesControlItem[] = selectedPrefillNodeIds.flatMap(
    (nodeId, index) => [
      {
        key: `${nodeId}_queue`,
        label: `${nodeId} queue`,
        color: ["#f59e0b", "#d97706", "#b45309", "#92400e"][index % 4],
      },
      {
        key: `${nodeId}_batch`,
        label: `${nodeId} batch`,
        color: ["#10b981", "#059669", "#0d9488", "#0f766e"][index % 4],
      },
    ],
  );
  const visiblePrefillSeriesKeys =
    prefillSeriesFilter.filter((key) =>
      prefillSeriesItems.some((item) => item.key === key),
    ).length > 0
      ? prefillSeriesFilter.filter((key) =>
          prefillSeriesItems.some((item) => item.key === key),
        )
      : prefillSeriesItems.map((item) => item.key);
  const decodeBatchChartData = batchData.map((point) => {
    const batchPoint = point as Record<string, number | string>;
    const normalized: Record<string, number | string> = {
      time: point.time,
    };
    for (const nodeId of visibleDecodeKeys) {
      normalized[nodeId] = Number(batchPoint[nodeId] ?? 0);
    }
    return normalized;
  });
  const toggleSeriesKey = (
    current: string[],
    all: string[],
    key: string,
  ) => {
    const base = current.filter((item) => all.includes(item)).length > 0
      ? current.filter((item) => all.includes(item))
      : all;

    if (base.includes(key)) {
      return base.length === 1 ? base : base.filter((item) => item !== key);
    }

    return [...base, key];
  };
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
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
        <SummaryCard
          title={zh ? "成功请求" : "Success"}
          value={`${snapshot.metrics.completedRequests}/${snapshot.metrics.totalRequests}`}
          hint={
            zh
              ? `当前视窗内仍有 ${snapshot.metrics.failedRequests} 个未完成`
              : `${snapshot.metrics.failedRequests} incomplete at current horizon`
          }
        />
        <SummaryCard
          title={zh ? "平均 TTFT" : "Avg TTFT"}
          value={formatMs(snapshot.metrics.ttft.avg)}
          hint={`p90 ${formatMs(snapshot.metrics.ttft.p90)}`}
        />
        <SummaryCard
          title={zh ? "平均 TPOT" : "Avg TPOT"}
          value={formatMs(snapshot.metrics.tpot.avg)}
          hint={`p99 ${formatMs(snapshot.metrics.tpot.p99)}`}
        />
        <SummaryCard
          title={zh ? "平均 E2EL" : "Avg E2EL"}
          value={formatMs(snapshot.metrics.e2eLatency.avg)}
          hint={`p99 ${formatMs(snapshot.metrics.e2eLatency.p99)}`}
        />
        <SummaryCard
          title={zh ? "平均输出 Tok/s" : "Avg OutTok/s"}
          value={formatThroughput(
            snapshot.metrics.outputTokenThroughput.avg,
            "tok/s",
          )}
          hint={`p90 ${formatThroughput(snapshot.metrics.outputTokenThroughput.p90, "tok/s")}`}
        />
        <SummaryCard
          title={zh ? "Prefill Tok/s" : "Prefill Tok/s"}
          value={formatThroughput(snapshot.metrics.prefillTokenThroughput, "tok/s")}
          hint={formatTokens(snapshot.metrics.totalInputTokens)}
        />
        <SummaryCard
          title={zh ? "输出 Tok/s" : "Output Tok/s"}
          value={formatThroughput(snapshot.metrics.systemOutputThroughput, "tok/s")}
          hint={formatTokens(snapshot.metrics.totalOutputTokens)}
        />
        <SummaryCard
          title={zh ? "总 Tok/s" : "Total Tok/s"}
          value={formatThroughput(snapshot.metrics.totalTokenThroughput, "tok/s")}
          hint={formatMs(snapshot.metrics.benchmarkDurationMs)}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>{zh ? "指标与图表" : "Metrics & Charts"}</CardTitle>
          <Tabs value={chartMode} onValueChange={(value) => onChartModeChange(value as "realtime" | "final")}>
            <TabsList>
              <TabsTrigger value="realtime">
                {zh ? "实时模式" : "Realtime Mode"}
              </TabsTrigger>
              <TabsTrigger value="final">
                {zh ? "最终汇总" : "Final Mode"}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="min-w-0 rounded-xl border border-[color:var(--border)] p-3">
              <p className="mb-3 text-sm font-semibold">
                {zh ? "按请求查看 TTFT" : "TTFT by Request"}
              </p>
              <SeriesLegendControl
                title={zh ? "图例控制" : "Legend"}
                items={ttftSeriesItems}
                selectedKeys={visibleTtftKeys}
                onToggle={(key) =>
                  setTtftSeriesFilter((current) =>
                    toggleSeriesKey(
                      current,
                      ttftSeriesItems.map((item) => item.key),
                      key,
                    ),
                  )
                }
              />
              <div className="h-72 min-w-0">
                {mounted ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={288}>
                  <BarChart data={ttftData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                    <XAxis dataKey="request" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip />
                    {visibleTtftKeys.includes("ttftMs") ? (
                      <Bar dataKey="ttftMs" fill="#0f766e" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    ) : null}
                  </BarChart>
                </ResponsiveContainer>
                ) : chartFallback}
              </div>
            </div>

            <div className="min-w-0 rounded-xl border border-[color:var(--border)] p-3">
              <p className="mb-3 text-sm font-semibold">
                {zh ? "按请求查看 TPOT" : "TPOT by Request"}
              </p>
              <SeriesLegendControl
                title={zh ? "图例控制" : "Legend"}
                items={tpotSeriesItems}
                selectedKeys={visibleTpotKeys}
                onToggle={(key) =>
                  setTpotSeriesFilter((current) =>
                    toggleSeriesKey(
                      current,
                      tpotSeriesItems.map((item) => item.key),
                      key,
                    ),
                  )
                }
              />
              <div className="h-72 min-w-0">
                {mounted ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={288}>
                  <BarChart data={tpotData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                    <XAxis dataKey="request" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip />
                    {visibleTpotKeys.includes("tpotMs") ? (
                      <Bar dataKey="tpotMs" fill="#2563eb" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    ) : null}
                  </BarChart>
                </ResponsiveContainer>
                ) : chartFallback}
              </div>
            </div>

            <div className="min-w-0 rounded-xl border border-[color:var(--border)] p-3">
              <p className="mb-3 text-sm font-semibold">
                {zh ? "吞吐趋势" : "Throughput"}
              </p>
              <SeriesLegendControl
                title={zh ? "图例控制" : "Legend"}
                items={throughputSeries}
                selectedKeys={visibleThroughputKeys}
                onToggle={(key) =>
                  setThroughputSeriesFilter((current) =>
                    toggleSeriesKey(
                      current,
                      throughputSeries.map((item) => item.key),
                      key,
                    ),
                  )
                }
              />
              <div className="h-72 min-w-0">
                {mounted ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={288}>
                  <LineChart data={throughputData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                    <XAxis dataKey="time" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip />
                    {visibleThroughputKeys.includes("prefillTokenThroughput") ? (
                      <Line type="monotone" dataKey="prefillTokenThroughput" stroke="#a16207" dot={false} strokeWidth={2} isAnimationActive={false} />
                    ) : null}
                    {visibleThroughputKeys.includes("inputThroughput") ? (
                      <Line type="monotone" dataKey="inputThroughput" stroke="#f59e0b" dot={false} strokeWidth={2} isAnimationActive={false} />
                    ) : null}
                    {visibleThroughputKeys.includes("outputThroughput") ? (
                      <Line type="monotone" dataKey="outputThroughput" stroke="#0ea5e9" dot={false} strokeWidth={2} isAnimationActive={false} />
                    ) : null}
                    {visibleThroughputKeys.includes("totalTokenThroughput") ? (
                      <Line type="monotone" dataKey="totalTokenThroughput" stroke="#7c3aed" dot={false} strokeWidth={2} isAnimationActive={false} />
                    ) : null}
                    {visibleThroughputKeys.includes("requestThroughput") ? (
                      <Line type="monotone" dataKey="requestThroughput" stroke="#10b981" dot={false} strokeWidth={2} isAnimationActive={false} />
                    ) : null}
                  </LineChart>
                </ResponsiveContainer>
                ) : chartFallback}
              </div>
            </div>

            <div className="min-w-0 rounded-xl border border-[color:var(--border)] p-3">
              <p className="mb-3 text-sm font-semibold">
                {zh ? "按请求查看输出 Token 吞吐" : "OutputTokenThroughput by Request"}
              </p>
              <SeriesLegendControl
                title={zh ? "图例控制" : "Legend"}
                items={outputTokenSeriesItems}
                selectedKeys={visibleOutputTokenKeys}
                onToggle={(key) =>
                  setOutputTokenSeriesFilter((current) =>
                    toggleSeriesKey(
                      current,
                      outputTokenSeriesItems.map((item) => item.key),
                      key,
                    ),
                  )
                }
              />
              <div className="h-72 min-w-0">
                {mounted ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={288}>
                  <BarChart data={outputTokenThroughputData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                    <XAxis dataKey="request" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip />
                    {visibleOutputTokenKeys.includes("outputTokenThroughputTokPerSec") ? (
                      <Bar
                        dataKey="outputTokenThroughputTokPerSec"
                        fill="#7c3aed"
                        radius={[4, 4, 0, 0]}
                        isAnimationActive={false}
                      />
                    ) : null}
                  </BarChart>
                </ResponsiveContainer>
                ) : chartFallback}
              </div>
            </div>

            <div className="min-w-0 rounded-xl border border-[color:var(--border)] p-3">
              <p className="mb-3 text-sm font-semibold">
                {zh ? "队列长度" : "Queue Length"}
              </p>
              <SeriesLegendControl
                title={zh ? "图例控制" : "Legend"}
                items={queueSeriesItems}
                selectedKeys={visibleQueueKeys}
                onToggle={(key) =>
                  setQueueSeriesFilter((current) =>
                    toggleSeriesKey(current, queueKeys, key),
                  )
                }
              />
              <div className="h-72 min-w-0">
                {mounted ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={288}>
                  <LineChart data={queueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                    <XAxis dataKey="time" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip />
                    {visibleQueueKeys.map((key, index) => (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={["#f59e0b", "#0ea5e9", "#8b5cf6", "#10b981"][index % 4]}
                        dot={false}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                ) : chartFallback}
              </div>
            </div>

            <div className="min-w-0 rounded-xl border border-[color:var(--border)] p-3">
              <p className="mb-3 text-sm font-semibold">
                {zh ? "Decode 活跃 Batch 随时间变化" : "Decode Active Batch Over Time"}
              </p>
              <NodeFilter
                title={zh ? "Decode 节点" : "Decode nodes"}
                nodeIds={decodeNodeIds}
                selectedNodeIds={selectedDecodeNodeIds}
                onToggle={toggleDecodeNode}
              />
              <SeriesLegendControl
                title={zh ? "图例控制" : "Legend"}
                items={decodeSeriesItems}
                selectedKeys={visibleDecodeKeys}
                onToggle={(key) =>
                  setDecodeSeriesFilter((current) =>
                    toggleSeriesKey(
                      current,
                      decodeSeriesItems.map((item) => item.key),
                      key,
                    ),
                  )
                }
              />
              <div className="h-72 min-w-0">
                {mounted ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={288}>
                  <LineChart data={decodeBatchChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                    <XAxis dataKey="time" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip />
                    {visibleDecodeKeys.map((nodeId, index) => (
                      <Line
                        key={nodeId}
                        type="monotone"
                        dataKey={nodeId}
                        stroke={["#0ea5e9", "#2563eb", "#8b5cf6", "#14b8a6"][index % 4]}
                        dot={false}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                ) : chartFallback}
              </div>
            </div>

            <div className="min-w-0 rounded-xl border border-[color:var(--border)] p-3">
              <p className="mb-3 text-sm font-semibold">
                {zh
                  ? "Prefill 队列与活跃 Batch 随时间变化"
                  : "Prefill Queue + Active Batch Over Time"}
              </p>
              <NodeFilter
                title={zh ? "Prefill 节点" : "Prefill nodes"}
                nodeIds={prefillNodeIds}
                selectedNodeIds={selectedPrefillNodeIds}
                onToggle={togglePrefillNode}
              />
              <SeriesLegendControl
                title={zh ? "图例控制" : "Legend"}
                items={prefillSeriesItems}
                selectedKeys={visiblePrefillSeriesKeys}
                onToggle={(key) =>
                  setPrefillSeriesFilter((current) =>
                    toggleSeriesKey(
                      current,
                      prefillSeriesItems.map((item) => item.key),
                      key,
                    ),
                  )
                }
              />
              <div className="h-72 min-w-0">
                {mounted ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={288}>
                  <LineChart data={prefillCombinedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                    <XAxis dataKey="time" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip />
                    {selectedPrefillNodeIds.map((nodeId, index) =>
                      visiblePrefillSeriesKeys.includes(`${nodeId}_queue`) ? (
                      <Line
                        key={`${nodeId}_queue`}
                        type="monotone"
                        dataKey={`${nodeId}_queue`}
                        name={`${nodeId} queue`}
                        stroke={["#f59e0b", "#d97706", "#b45309", "#92400e"][index % 4]}
                        dot={false}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                      ) : null,
                    )}
                    {selectedPrefillNodeIds.map((nodeId, index) =>
                      visiblePrefillSeriesKeys.includes(`${nodeId}_batch`) ? (
                      <Line
                        key={`${nodeId}_batch`}
                        type="monotone"
                        dataKey={`${nodeId}_batch`}
                        name={`${nodeId} active batch`}
                        stroke={["#10b981", "#059669", "#0d9488", "#0f766e"][index % 4]}
                        dot={false}
                        strokeDasharray="6 4"
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                      ) : null,
                    )}
                  </LineChart>
                </ResponsiveContainer>
                ) : chartFallback}
              </div>
            </div>
          </div>

          <PercentileTable snapshot={snapshot} locale={locale} />
          <CommonMetricTable snapshot={snapshot} locale={locale} />
        </CardContent>
      </Card>
    </div>
  );
}
