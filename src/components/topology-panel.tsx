"use client";

import { ArrowRight } from "lucide-react";

import { formatMs, formatPercent } from "@/lib/format";
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

function arrivalPatternLabel(snapshot: ControllerSnapshot) {
  return snapshot.config.arrivalPattern === "burst_per_sec"
    ? `${snapshot.config.reqPerSec} req/s burst each second`
    : `${snapshot.config.reqPerSec} req/s uniform every ${formatMs(
        1000 / snapshot.config.reqPerSec,
      )}`;
}

function NodeCard({ node, snapshot }: { node: NodeSnapshot; snapshot: ControllerSnapshot }) {
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
          <p className="text-xs text-[color:var(--muted-foreground)]">{node.kind}</p>
        </div>
        <Badge variant={node.busy ? "warning" : "info"}>
          {node.busy ? "BUSY" : "IDLE"}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-[color:var(--muted-foreground)]">Queue</p>
          <p className="font-mono">{node.queueLength}</p>
        </div>
        <div>
          <p className="text-[color:var(--muted-foreground)]">Current</p>
          <p className="font-mono">
            {node.currentRequestIds.length > 0
              ? node.currentRequestIds.slice(0, 3).join(", ")
              : "-"}
          </p>
        </div>
        <div>
          <p className="text-[color:var(--muted-foreground)]">Processed</p>
          <p className="font-mono">{node.processedCount}</p>
        </div>
        <div>
          <p className="text-[color:var(--muted-foreground)]">Utilization</p>
          <p className="font-mono">{formatPercent(node.utilization)}</p>
        </div>
        <div>
          <p className="text-[color:var(--muted-foreground)]">Active batch</p>
          <p className="font-mono">{node.activeBatchSize}</p>
        </div>
        <div>
          <p className="text-[color:var(--muted-foreground)]">Current step</p>
          <p className="font-mono">
            {node.currentStepDurationMs !== undefined
              ? formatMs(node.currentStepDurationMs)
              : "N/A"}
          </p>
        </div>
        <div className="col-span-2">
          <p className="text-[color:var(--muted-foreground)]">Step model</p>
          <p className="font-mono">{stepModel}</p>
        </div>
        <div className="col-span-2">
          <p className="text-[color:var(--muted-foreground)]">Busy until</p>
          <p className="font-mono">{formatMs(node.busyUntilMs)}</p>
        </div>
      </div>
    </div>
  );
}

function ArrowBadge({ count, label }: { count: number; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
      <ArrowRight className="h-4 w-4 text-[color:var(--accent-strong)]" />
      <span>{label}</span>
      <Badge variant={count > 0 ? "success" : "default"}>{count} in-flight</Badge>
    </div>
  );
}

export function TopologyPanel({ snapshot }: { snapshot: ControllerSnapshot }) {
  const client = snapshot.nodes.find((node) => node.id === "client");
  const coordinator = snapshot.nodes.find((node) => node.id === "coordinator");
  const prefillNodes = snapshot.nodes.filter((node) => node.kind === "prefill");
  const decodeNodes = snapshot.nodes.filter((node) => node.kind === "decode");

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Topology</CardTitle>
        <CardDescription>
          Client -&gt; Coordinator -&gt; Prefill -&gt; Decode -&gt; Client. Node panels
          expose batch size, actual step time, and linear batch-time model.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--secondary)]/45 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
            Arrival Pattern
          </p>
          <p className="mt-2 text-sm font-semibold">{snapshot.config.arrivalPattern}</p>
          <p className="mt-1 font-mono text-xs text-[color:var(--muted-foreground)]">
            {arrivalPatternLabel(snapshot)}
          </p>
        </div>

        <div className="grid gap-3">
          {client ? <NodeCard node={client} snapshot={snapshot} /> : null}
          <ArrowBadge
            label="client -> coordinator"
            count={linkCount(snapshot, "client", "coordinator")}
          />
          {coordinator ? <NodeCard node={coordinator} snapshot={snapshot} /> : null}
          <ArrowBadge
            label="coordinator -> prefill"
            count={snapshot.activeTransfers.filter(
              (transfer) =>
                transfer.from === "coordinator" && transfer.to.startsWith("P"),
            ).length}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
              Prefill Pool
            </h4>
            <Badge variant="info">{prefillNodes.length} nodes</Badge>
          </div>
          <div className="grid gap-3">
            {prefillNodes.map((node) => (
              <NodeCard key={node.id} node={node} snapshot={snapshot} />
            ))}
          </div>
        </div>

        <ArrowBadge
          label="prefill -> decode"
          count={snapshot.activeTransfers.filter(
            (transfer) => transfer.from.startsWith("P") && transfer.to.startsWith("D"),
          ).length}
        />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
              Decode Pool
            </h4>
            <Badge variant="info">{decodeNodes.length} nodes</Badge>
          </div>
          <div className="grid gap-3">
            {decodeNodes.map((node) => (
              <NodeCard key={node.id} node={node} snapshot={snapshot} />
            ))}
          </div>
        </div>

        <ArrowBadge
          label="decode -> client"
          count={snapshot.activeTransfers.filter(
            (transfer) => transfer.from.startsWith("D") && transfer.to === "client",
          ).length}
        />
      </CardContent>
    </Card>
  );
}
