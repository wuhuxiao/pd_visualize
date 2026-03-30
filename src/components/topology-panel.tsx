"use client";

import { ArrowRight } from "lucide-react";

import { formatMs, formatPercent } from "@/lib/format";
import {
  type UiLocale,
  translateArrivalPattern,
  translateNodeKind,
} from "@/lib/i18n";
import type { ControllerSnapshot, NodeSnapshot } from "@/types/simulation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function linkCount(snapshot: ControllerSnapshot, from: string, to: string) {
  return snapshot.activeTransfers.filter(
    (transfer) => transfer.from === from && transfer.to === to,
  ).length;
}

function arrivalPatternLabel(snapshot: ControllerSnapshot, locale: UiLocale) {
  const zh = locale === "zh-CN";
  if (snapshot.config.arrivalPattern === "aisbench_request_rate") {
    return snapshot.config.reqPerSec < 0.1
      ? zh
        ? `AISBench request_rate=${snapshot.config.reqPerSec}，不限制速率，客户端 batch_size=${snapshot.config.clientBatchSize}`
        : `AISBench request_rate=${snapshot.config.reqPerSec}, no rate limit, client batch_size=${snapshot.config.clientBatchSize}`
      : zh
        ? `AISBench request_rate=${snapshot.config.reqPerSec}，客户端 batch_size=${snapshot.config.clientBatchSize}，每 ${formatMs(
            1000 / snapshot.config.reqPerSec,
          )} 释放一个请求`
        : `AISBench request_rate=${snapshot.config.reqPerSec}, client batch_size=${snapshot.config.clientBatchSize}, one release every ${formatMs(
          1000 / snapshot.config.reqPerSec,
        )}`;
  }

  return snapshot.config.arrivalPattern === "burst_per_sec"
    ? zh
      ? `${snapshot.config.reqPerSec} req/s，每秒突发发送`
      : `${snapshot.config.reqPerSec} req/s burst each second`
    : zh
      ? `${snapshot.config.reqPerSec} req/s，每 ${formatMs(
          1000 / snapshot.config.reqPerSec,
        )} 等间隔发送`
      : `${snapshot.config.reqPerSec} req/s uniform every ${formatMs(
        1000 / snapshot.config.reqPerSec,
      )}`;
}

function NodeCard({
  node,
  snapshot,
  locale,
}: {
  node: NodeSnapshot;
  snapshot: ControllerSnapshot;
  locale: UiLocale;
}) {
  const zh = locale === "zh-CN";
  const stepModel =
    node.kind === "prefill"
      ? `${snapshot.config.prefillTimeSlopeMs} * batch + ${snapshot.config.prefillTimePerRequestMs}`
      : node.kind === "decode"
        ? `${snapshot.config.decodeStepTimeSlopeMs} * batch + ${snapshot.config.decodeStepTimeMs}`
        : "N/A";

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-white/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{node.id}</p>
          <p className="text-xs text-[color:var(--muted-foreground)]">
            {translateNodeKind(node.kind, locale)}
          </p>
        </div>
        <Badge variant={node.busy ? "warning" : "info"}>
          {node.busy ? (zh ? "忙碌" : "BUSY") : zh ? "空闲" : "IDLE"}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-[color:var(--muted-foreground)]">
            {zh ? "队列" : "Queue"}
          </p>
          <p className="font-mono">{node.queueLength}</p>
        </div>
        <div>
          <p className="text-[color:var(--muted-foreground)]">
            {zh ? "当前请求" : "Current"}
          </p>
          <p className="font-mono">
            {node.currentRequestIds.length > 0
              ? node.currentRequestIds.slice(0, 3).join(", ")
              : "-"}
          </p>
        </div>
        <div>
          <p className="text-[color:var(--muted-foreground)]">
            {zh ? "累计处理" : "Processed"}
          </p>
          <p className="font-mono">{node.processedCount}</p>
        </div>
        <div>
          <p className="text-[color:var(--muted-foreground)]">
            {zh ? "利用率" : "Utilization"}
          </p>
          <p className="font-mono">{formatPercent(node.utilization)}</p>
        </div>
        <div>
          <p className="text-[color:var(--muted-foreground)]">
            {zh ? "活跃 batch" : "Active batch"}
          </p>
          <p className="font-mono">{node.activeBatchSize}</p>
        </div>
        <div>
          <p className="text-[color:var(--muted-foreground)]">
            {zh ? "当前 step 耗时" : "Current step"}
          </p>
          <p className="font-mono">
            {node.currentStepDurationMs !== undefined
              ? formatMs(node.currentStepDurationMs)
              : "N/A"}
          </p>
        </div>
        <div className="col-span-2">
          <p className="text-[color:var(--muted-foreground)]">
            {zh ? "Step 模型" : "Step model"}
          </p>
          <p className="font-mono">{stepModel}</p>
        </div>
        <div className="col-span-2">
          <p className="text-[color:var(--muted-foreground)]">
            {zh ? "忙碌到" : "Busy until"}
          </p>
          <p className="font-mono">{formatMs(node.busyUntilMs)}</p>
        </div>
      </div>
    </div>
  );
}

function ArrowBadge({
  count,
  label,
  locale,
}: {
  count: number;
  label: string;
  locale: UiLocale;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
      <ArrowRight className="h-4 w-4 text-[color:var(--accent-strong)]" />
      <span>{label}</span>
      <Badge variant={count > 0 ? "success" : "default"}>
        {count} {locale === "zh-CN" ? "在途" : "in-flight"}
      </Badge>
    </div>
  );
}

export function TopologyPanel({
  snapshot,
  locale,
}: {
  snapshot: ControllerSnapshot;
  locale: UiLocale;
}) {
  const zh = locale === "zh-CN";
  const client = snapshot.nodes.find((node) => node.id === "client");
  const coordinator = snapshot.nodes.find((node) => node.id === "coordinator");
  const prefillNodes = snapshot.nodes.filter((node) => node.kind === "prefill");
  const decodeNodes = snapshot.nodes.filter((node) => node.kind === "decode");

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{zh ? "系统拓扑" : "Topology"}</CardTitle>
        <CardDescription>
          {zh
            ? "Client -> Coordinator -> Prefill -> Decode -> Client。节点卡片会展示 batch 大小、当前 step 实际耗时，以及线性 batch 耗时模型。"
            : "Client -> Coordinator -> Prefill -> Decode -> Client. Node panels expose batch size, actual step time, and linear batch-time model."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--secondary)]/45 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
            {zh ? "到达模式" : "Arrival Pattern"}
          </p>
          <p className="mt-2 text-sm font-semibold">
            {translateArrivalPattern(snapshot.config.arrivalPattern, locale)}
          </p>
          <p className="mt-1 font-mono text-xs text-[color:var(--muted-foreground)]">
            {arrivalPatternLabel(snapshot, locale)}
          </p>
        </div>

        <div className="grid gap-3">
          {client ? <NodeCard node={client} snapshot={snapshot} locale={locale} /> : null}
          <ArrowBadge
            label={zh ? "客户端 -> 协调器" : "client -> coordinator"}
            count={linkCount(snapshot, "client", "coordinator")}
            locale={locale}
          />
          {coordinator ? (
            <NodeCard node={coordinator} snapshot={snapshot} locale={locale} />
          ) : null}
          <ArrowBadge
            label={zh ? "协调器 -> Prefill" : "coordinator -> prefill"}
            count={snapshot.activeTransfers.filter(
              (transfer) =>
                transfer.from === "coordinator" && transfer.to.startsWith("P"),
            ).length}
            locale={locale}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
              {zh ? "Prefill 节点池" : "Prefill Pool"}
            </h4>
            <Badge variant="info">
              {prefillNodes.length} {zh ? "个节点" : "nodes"}
            </Badge>
          </div>
          <div className="grid gap-3">
            {prefillNodes.map((node) => (
              <NodeCard
                key={node.id}
                node={node}
                snapshot={snapshot}
                locale={locale}
              />
            ))}
          </div>
        </div>

        <ArrowBadge
          label={zh ? "Prefill -> Decode" : "prefill -> decode"}
          count={snapshot.activeTransfers.filter(
            (transfer) => transfer.from.startsWith("P") && transfer.to.startsWith("D"),
          ).length}
          locale={locale}
        />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
              {zh ? "Decode 节点池" : "Decode Pool"}
            </h4>
            <Badge variant="info">
              {decodeNodes.length} {zh ? "个节点" : "nodes"}
            </Badge>
          </div>
          <div className="grid gap-3">
            {decodeNodes.map((node) => (
              <NodeCard
                key={node.id}
                node={node}
                snapshot={snapshot}
                locale={locale}
              />
            ))}
          </div>
        </div>

        <ArrowBadge
          label={zh ? "Decode -> 客户端" : "decode -> client"}
          count={snapshot.activeTransfers.filter(
            (transfer) => transfer.from.startsWith("D") && transfer.to === "client",
          ).length}
          locale={locale}
        />
      </CardContent>
    </Card>
  );
}
