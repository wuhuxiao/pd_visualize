import {
  buildBucketSeries,
  buildNodeValueBucketSeries,
  buildQueueBucketSeries,
  computeRequestMetrics,
  summarize,
} from "@/lib/stats";
import { clamp } from "@/lib/utils";
import { DEFAULT_SIMULATION_CONFIG } from "@/sim/default-config";
import { PriorityQueue } from "@/sim/priority-queue";
import type {
  AggregateMetrics,
  DispatchPolicy,
  MetricSeriesPoint,
  NodeKind,
  NodeSnapshot,
  QueueSeriesPoint,
  RequestEventType,
  RequestRecord,
  SimulationConfig,
  SimulationSnapshot,
  SystemEvent,
  TimeValueSample,
  TransferKind,
} from "@/types/simulation";

type EventType =
  | "generate_request"
  | "request_at_coordinator"
  | "request_at_prefill"
  | "prefill_batch_complete"
  | "request_at_decode"
  | "decode_batch_step_complete"
  | "tokens_at_client";

interface SimulationEvent {
  id: string;
  seq: number;
  timeMs: number;
  type: EventType;
  requestId?: string;
  nodeId?: string;
  tokenCount?: number;
  transferId?: string;
}

interface TransferState {
  id: string;
  requestId: string;
  from: string;
  to: string;
  kind: TransferKind;
  tokenCount: number;
  startTimeMs: number;
  endTimeMs: number;
}

interface NodeRuntime {
  id: string;
  kind: NodeKind;
  queue: string[];
  currentRequestIds: string[];
  processedCount: number;
  totalBusyTimeMs: number;
  busyUntilMs?: number;
  busySegmentStartMs?: number;
  currentStepDurationMs?: number;
  tokenCount: number;
  queueSamples: TimeValueSample[];
  batchSamples: TimeValueSample[];
}

/**
 * Pure discrete-event simulation engine.
 * Virtual time only moves when the controller asks for the next event
 * or advances to a target timestamp.
 */
export class SimulationEngine {
  private config: SimulationConfig;
  private currentTimeMs = 0;
  private durationMs = 0;
  private hasStarted = false;
  private hasFinished = false;
  private eventCounter = 0;
  private requestCounter = 0;
  private transferCounter = 0;
  private coordinatorDispatchCount = 0;
  private clientCompletedCount = 0;
  private roundRobinCursor = {
    prefill: 0,
    decode: 0,
  };
  private readonly queue = new PriorityQueue<SimulationEvent>((a, b) => {
    if (a.timeMs === b.timeMs) {
      return a.seq - b.seq;
    }
    return a.timeMs - b.timeMs;
  });
  private readonly requests = new Map<string, RequestRecord>();
  private readonly transfers = new Map<string, TransferState>();
  private readonly nodes = new Map<string, NodeRuntime>();
  private readonly prefillNodeIds: string[] = [];
  private readonly decodeNodeIds: string[] = [];
  private readonly inputEvents: Array<{ timeMs: number; tokens: number }> = [];
  private readonly outputEvents: Array<{ timeMs: number; tokens: number }> = [];
  private readonly completionEvents: number[] = [];
  private readonly realtimeSeries: MetricSeriesPoint[] = [];
  private readonly systemEvents: SystemEvent[] = [];

  constructor(config: SimulationConfig = DEFAULT_SIMULATION_CONFIG) {
    this.config = config;
    this.durationMs = config.simulationDurationSec * 1000;
    this.bootstrap();
  }

  getCurrentTimeMs() {
    return this.currentTimeMs;
  }

  getConfig() {
    return this.config;
  }

  reset(config: SimulationConfig = this.config) {
    this.config = config;
    this.currentTimeMs = 0;
    this.durationMs = config.simulationDurationSec * 1000;
    this.hasStarted = false;
    this.hasFinished = false;
    this.eventCounter = 0;
    this.requestCounter = 0;
    this.transferCounter = 0;
    this.coordinatorDispatchCount = 0;
    this.clientCompletedCount = 0;
    this.roundRobinCursor = {
      prefill: 0,
      decode: 0,
    };
    this.queue.clear();
    this.requests.clear();
    this.transfers.clear();
    this.nodes.clear();
    this.prefillNodeIds.length = 0;
    this.decodeNodeIds.length = 0;
    this.inputEvents.length = 0;
    this.outputEvents.length = 0;
    this.completionEvents.length = 0;
    this.realtimeSeries.length = 0;
    this.systemEvents.length = 0;
    this.bootstrap();
  }

  step() {
    if (this.hasFinished) {
      return this.getSnapshot();
    }

    const nextEvent = this.queue.peek();
    if (!nextEvent || nextEvent.timeMs > this.durationMs) {
      this.currentTimeMs = this.durationMs;
      this.hasFinished = true;
      this.captureSample();
      return this.getSnapshot();
    }

    const event = this.queue.pop();
    if (!event) {
      return this.getSnapshot();
    }

    this.currentTimeMs = event.timeMs;
    this.hasStarted = true;
    this.handleEvent(event);
    this.captureSample();

    if (this.currentTimeMs >= this.durationMs) {
      this.hasFinished = true;
    }

    return this.getSnapshot();
  }

  runUntil(targetTimeMs: number) {
    if (this.hasFinished) {
      return this.getSnapshot();
    }

    const boundedTarget = Math.min(targetTimeMs, this.durationMs);

    while (true) {
      const nextEvent = this.queue.peek();
      if (!nextEvent || nextEvent.timeMs > boundedTarget) {
        break;
      }

      this.step();
      if (this.hasFinished) {
        break;
      }
    }

    if (!this.hasFinished && boundedTarget > this.currentTimeMs) {
      this.currentTimeMs = boundedTarget;
      this.captureSample();
    }

    if (this.currentTimeMs >= this.durationMs) {
      this.hasFinished = true;
    }

    return this.getSnapshot();
  }

  getSnapshot(): SimulationSnapshot {
    const requestList = [...this.requests.values()]
      .map((request) => {
        const metrics = computeRequestMetrics(request);
        return {
          ...request,
          metrics: {
            ttftMs: metrics.ttftMs,
            tpotMs: metrics.tpotMs,
            e2eLatencyMs: metrics.e2eLatencyMs,
          },
        };
      })
      .sort((a, b) => a.sequence - b.sequence);
    const elapsedSeconds = Math.max(this.currentTimeMs / 1000, 0.001);
    const completedRequests = requestList.filter(
      (request) => request.finishTimeMs !== undefined,
    );
    const queueSamplesByNode = Object.fromEntries(
      [...this.nodes.values()]
        .filter((node) => node.kind === "prefill" || node.kind === "decode")
        .map((node) => [node.id, node.queueSamples]),
    );
    const batchSamplesByNode = Object.fromEntries(
      [...this.nodes.values()]
        .filter((node) => node.kind === "prefill" || node.kind === "decode")
        .map((node) => [node.id, node.batchSamples]),
    );

    const metrics: AggregateMetrics = {
      totalRequests: requestList.length,
      completedRequests: completedRequests.length,
      activeRequests: requestList.length - completedRequests.length,
      totalInputTokens: this.sumTokens(this.inputEvents),
      totalOutputTokens: this.sumTokens(this.outputEvents),
      systemInputThroughput: this.sumTokens(this.inputEvents) / elapsedSeconds,
      systemOutputThroughput: this.sumTokens(this.outputEvents) / elapsedSeconds,
      requestThroughput: completedRequests.length / elapsedSeconds,
      ttft: summarize(
        completedRequests
          .map((request) => request.metrics.ttftMs)
          .filter((value): value is number => value !== undefined),
      ),
      tpot: summarize(
        completedRequests
          .map((request) => request.metrics.tpotMs)
          .filter((value): value is number => value !== undefined),
      ),
      e2eLatency: summarize(
        completedRequests
          .map((request) => request.metrics.e2eLatencyMs)
          .filter((value): value is number => value !== undefined),
      ),
    };

    return {
      config: this.config,
      currentTimeMs: this.currentTimeMs,
      durationMs: this.durationMs,
      progress: this.durationMs === 0 ? 0 : this.currentTimeMs / this.durationMs,
      hasStarted: this.hasStarted,
      hasFinished: this.hasFinished,
      requests: requestList,
      nodes: this.buildNodeSnapshots(),
      activeTransfers: [...this.transfers.values()].map((transfer) => ({
        ...transfer,
        progress: clamp(
          (this.currentTimeMs - transfer.startTimeMs) /
            Math.max(transfer.endTimeMs - transfer.startTimeMs, 1),
          0,
          1,
        ),
      })),
      metrics,
      realtimeSeries: [...this.realtimeSeries],
      finalSeries: buildBucketSeries(
        Math.max(this.currentTimeMs, 1),
        this.inputEvents,
        this.outputEvents,
        this.completionEvents,
      ),
      realtimeQueueSeries: this.buildRealtimeQueueSeries(),
      finalQueueSeries: buildQueueBucketSeries(
        Math.max(this.currentTimeMs, 1),
        queueSamplesByNode,
      ),
      realtimeBatchSeries: this.buildRealtimeBatchSeries(),
      finalBatchSeries: buildNodeValueBucketSeries(
        Math.max(this.currentTimeMs, 1),
        batchSamplesByNode,
      ),
      ttftSeries: requestList.map(computeRequestMetrics),
      tpotSeries: requestList.map(computeRequestMetrics),
      systemEvents: [...this.systemEvents],
    };
  }

  private bootstrap() {
    this.createNode("client", "client");
    this.createNode("coordinator", "coordinator");

    for (let index = 0; index < this.config.prefillNodeCount; index += 1) {
      const nodeId = `P${index}`;
      this.createNode(nodeId, "prefill");
      this.prefillNodeIds.push(nodeId);
    }

    for (let index = 0; index < this.config.decodeNodeCount; index += 1) {
      const nodeId = `D${index}`;
      this.createNode(nodeId, "decode");
      this.decodeNodeIds.push(nodeId);
    }

    this.scheduleArrivals();
    this.captureSample();
  }

  private createNode(id: string, kind: NodeKind) {
    this.nodes.set(id, {
      id,
      kind,
      queue: [],
      currentRequestIds: [],
      processedCount: 0,
      totalBusyTimeMs: 0,
      currentStepDurationMs: undefined,
      tokenCount: 0,
      queueSamples: [{ timeMs: 0, value: 0 }],
      batchSamples: [{ timeMs: 0, value: 0 }],
    });
  }

  private scheduleArrivals() {
    if (this.config.arrivalPattern === "uniform_interval") {
      let timeMs = 0;
      let generated = 0;
      const intervalMs = 1000 / this.config.reqPerSec;

      while (timeMs <= this.durationMs && generated < this.config.maxRequestCount) {
        this.enqueue({ timeMs, type: "generate_request" });
        generated += 1;
        timeMs += intervalMs;
      }

      return;
    }

    let secondMarkMs = 0;
    let generated = 0;
    let carry = 0;

    while (
      secondMarkMs <= this.durationMs &&
      generated < this.config.maxRequestCount
    ) {
      carry += this.config.reqPerSec;
      const toEmit = Math.min(
        Math.floor(carry + 1e-9),
        this.config.maxRequestCount - generated,
      );

      carry -= toEmit;
      for (let index = 0; index < toEmit; index += 1) {
        this.enqueue({ timeMs: secondMarkMs, type: "generate_request" });
        generated += 1;
      }

      secondMarkMs += 1000;
    }
  }

  private enqueue(event: Omit<SimulationEvent, "id" | "seq">) {
    this.queue.push({
      ...event,
      id: `event-${this.eventCounter + 1}`,
      seq: this.eventCounter++,
    });
  }

  private createRequest(arrivalTimeMs: number) {
    const id = `R${String(this.requestCounter).padStart(3, "0")}`;
    const request: RequestRecord = {
      id,
      sequence: this.requestCounter,
      inputTokens: this.config.inputTokensPerRequest,
      outputTokensTarget: this.config.outputTokensPerRequest,
      outputTokensProduced: 0,
      outputTokensDelivered: 0,
      arrivalTimeMs,
      status: "created",
      metrics: {},
      timeline: [],
    };

    this.requestCounter += 1;
    this.requests.set(id, request);
    return request;
  }

  private handleEvent(event: SimulationEvent) {
    switch (event.type) {
      case "generate_request":
        this.handleGenerateRequest();
        break;
      case "request_at_coordinator":
        this.finishTransfer(event.transferId);
        this.handleRequestAtCoordinator(event.requestId);
        break;
      case "request_at_prefill":
        this.finishTransfer(event.transferId);
        this.handleRequestAtPrefill(event.requestId, event.nodeId);
        break;
      case "prefill_batch_complete":
        this.handlePrefillBatchComplete(event.nodeId);
        break;
      case "request_at_decode":
        this.finishTransfer(event.transferId);
        this.handleRequestAtDecode(event.requestId, event.nodeId);
        break;
      case "decode_batch_step_complete":
        this.handleDecodeBatchStepComplete(event.nodeId);
        break;
      case "tokens_at_client":
        this.finishTransfer(event.transferId);
        this.handleTokensAtClient(event.requestId, event.tokenCount ?? 0);
        break;
      default:
        break;
    }
  }

  private handleGenerateRequest() {
    const request = this.createRequest(this.currentTimeMs);
    request.status = "to_coordinator";
    this.inputEvents.push({
      timeMs: this.currentTimeMs,
      tokens: request.inputTokens,
    });
    this.appendRequestEvent(request, "arrival", "Client received request");
    this.appendSystemEvent(`Client emitted ${request.id}`, request.id, "client");
    this.transferRequest(
      request.id,
      "client",
      "coordinator",
      "request",
      0,
      this.config.networkLatencyClientToCoordinatorMs,
      "request_at_coordinator",
    );
  }

  private handleRequestAtCoordinator(requestId?: string) {
    if (!requestId) {
      return;
    }

    const request = this.getRequest(requestId);
    request.coordinatorArrivalTimeMs = this.currentTimeMs;
    const nodeId = this.selectNode("prefill", this.config.coordinatorDispatchPolicy);
    request.prefillNodeId = nodeId;
    this.coordinatorDispatchCount += 1;
    this.appendRequestEvent(
      request,
      "dispatch",
      `Coordinator dispatched to ${nodeId}`,
    );
    this.appendSystemEvent(`${request.id} -> ${nodeId}`, request.id, nodeId);
    this.transferRequest(
      request.id,
      "coordinator",
      nodeId,
      "request",
      0,
      this.config.networkLatencyCoordinatorToPrefillMs,
      "request_at_prefill",
      nodeId,
    );
  }

  private handleRequestAtPrefill(requestId?: string, nodeId?: string) {
    if (!requestId || !nodeId) {
      return;
    }

    const request = this.getRequest(requestId);
    const node = this.getNode(nodeId);
    request.status = "queued_prefill";
    request.prefillQueueEnterTimeMs = this.currentTimeMs;
    node.queue.push(request.id);
    this.recordQueueSample(node);
    this.appendRequestEvent(request, "enqueue", `${nodeId} queue +1`);
    this.appendSystemEvent(`${request.id} queued on ${nodeId}`, request.id, nodeId);
    this.tryStartPrefill(node);
  }

  private handlePrefillBatchComplete(nodeId?: string) {
    if (!nodeId) {
      return;
    }

    const node = this.getNode(nodeId);
    const completedBatch = [...node.currentRequestIds];
    if (completedBatch.length === 0) {
      return;
    }

    node.currentRequestIds = [];
    node.busyUntilMs = undefined;
    node.busySegmentStartMs = undefined;
    node.currentStepDurationMs = undefined;
    this.recordBatchSample(node);
    node.totalBusyTimeMs += this.prefillBatchDurationMs(completedBatch.length);

    for (const requestId of completedBatch) {
      const request = this.getRequest(requestId);
      request.prefillEndTimeMs = this.currentTimeMs;
      request.status = "to_decode";
      node.processedCount += 1;
      this.appendRequestEvent(request, "complete", `${nodeId} completed prefill`);
      const decodeNodeId = this.selectNode(
        "decode",
        this.config.coordinatorDispatchPolicy,
      );
      request.decodeNodeId = decodeNodeId;
      this.appendSystemEvent(
        `${request.id} moved from ${nodeId} to ${decodeNodeId}`,
        request.id,
        decodeNodeId,
      );
      this.transferRequest(
        request.id,
        nodeId,
        decodeNodeId,
        "request",
        0,
        this.config.networkLatencyPrefillToDecodeMs,
        "request_at_decode",
        decodeNodeId,
      );
    }

    this.tryStartPrefill(node);
  }

  private handleRequestAtDecode(requestId?: string, nodeId?: string) {
    if (!requestId || !nodeId) {
      return;
    }

    const request = this.getRequest(requestId);
    const node = this.getNode(nodeId);
    request.status = "queued_decode";
    request.decodeQueueEnterTimeMs = this.currentTimeMs;
    node.queue.push(request.id);
    this.recordQueueSample(node);
    this.appendRequestEvent(request, "enqueue", `${nodeId} queue +1`);
    this.appendSystemEvent(`${request.id} queued on ${nodeId}`, request.id, nodeId);
    this.tryStartDecode(node);
  }

  private handleDecodeBatchStepComplete(nodeId?: string) {
    if (!nodeId) {
      return;
    }

    const node = this.getNode(nodeId);
    const activeBatch = [...node.currentRequestIds];
    if (activeBatch.length === 0) {
      return;
    }

    node.busyUntilMs = undefined;
    node.busySegmentStartMs = undefined;
    node.currentStepDurationMs = undefined;
    node.totalBusyTimeMs += this.decodeBatchDurationMs(activeBatch.length);

    const remainingRequestIds: string[] = [];

    for (const requestId of activeBatch) {
      const request = this.getRequest(requestId);
      const tokenCount = this.nextDecodeChunk(request);
      if (tokenCount <= 0) {
        continue;
      }

      request.outputTokensProduced += tokenCount;
      node.tokenCount += tokenCount;
      this.transferRequest(
        request.id,
        nodeId,
        "client",
        "token",
        tokenCount,
        this.config.networkLatencyDecodeToClientMs,
        "tokens_at_client",
      );

      if (request.outputTokensProduced >= request.outputTokensTarget) {
        request.status = "streaming";
        node.processedCount += 1;
        this.appendRequestEvent(request, "complete", `${nodeId} finished decode`);
        this.appendSystemEvent(
          `${request.id} decode finished on ${nodeId}`,
          request.id,
          nodeId,
        );
        continue;
      }

      request.status = "decode";
      remainingRequestIds.push(request.id);
      this.appendRequestEvent(
        request,
        "stream",
        `${nodeId} streamed ${request.outputTokensProduced}/${request.outputTokensTarget} tokens`,
      );
    }

    node.currentRequestIds = remainingRequestIds;
    this.recordBatchSample(node);
    this.tryStartDecode(node);
  }

  private handleTokensAtClient(requestId?: string, tokenCount = 0) {
    if (!requestId) {
      return;
    }

    const request = this.getRequest(requestId);
    request.outputTokensDelivered += tokenCount;

    if (request.firstTokenTimeMs === undefined) {
      request.firstTokenTimeMs = this.currentTimeMs;
      this.appendRequestEvent(request, "stream", "First token reached client");
    }

    request.lastTokenTimeMs = this.currentTimeMs;
    this.outputEvents.push({
      timeMs: this.currentTimeMs,
      tokens: tokenCount,
    });

    if (request.outputTokensDelivered >= request.outputTokensTarget) {
      request.finishTimeMs = this.currentTimeMs;
      request.status = "completed";
      this.clientCompletedCount += 1;
      this.completionEvents.push(this.currentTimeMs);
      this.appendRequestEvent(request, "finish", "Request completed at client");
      this.appendSystemEvent(`${request.id} completed`, request.id, "client");
    } else {
      request.status = "streaming";
    }
  }

  private tryStartPrefill(node: NodeRuntime) {
    if (node.currentRequestIds.length > 0 || node.queue.length === 0) {
      return;
    }

    const batch = node.queue.splice(0, this.config.prefillBatchSize);
    if (batch.length === 0) {
      return;
    }

    const stepDurationMs = this.prefillBatchDurationMs(batch.length);
    node.currentRequestIds = batch;
    node.busySegmentStartMs = this.currentTimeMs;
    node.currentStepDurationMs = stepDurationMs;
    node.busyUntilMs = this.currentTimeMs + stepDurationMs;
    this.recordQueueSample(node);
    this.recordBatchSample(node);

    for (const requestId of batch) {
      const request = this.getRequest(requestId);
      request.prefillStartTimeMs = this.currentTimeMs;
      request.status = "prefill";
      this.appendRequestEvent(
        request,
        "start",
        `${node.id} started prefill batch (${batch.length})`,
      );
    }

    this.enqueue({
      timeMs: node.busyUntilMs,
      type: "prefill_batch_complete",
      nodeId: node.id,
    });
  }

  private tryStartDecode(node: NodeRuntime) {
    if (node.busyUntilMs !== undefined && node.busyUntilMs > this.currentTimeMs) {
      return;
    }

    const capacity = Math.max(
      this.config.decodeBatchSize - node.currentRequestIds.length,
      0,
    );
    if (capacity > 0 && node.queue.length > 0) {
      const newBatchMembers = node.queue.splice(0, capacity);
      this.recordQueueSample(node);
      for (const requestId of newBatchMembers) {
        const request = this.getRequest(requestId);
        request.decodeStartTimeMs = request.decodeStartTimeMs ?? this.currentTimeMs;
        request.status = "decode";
        node.currentRequestIds.push(requestId);
        this.appendRequestEvent(
          request,
          "start",
          `${node.id} joined decode batch (${node.currentRequestIds.length})`,
        );
      }
      this.recordBatchSample(node);
    }

    if (node.currentRequestIds.length === 0) {
      return;
    }

    const stepDurationMs = this.decodeBatchDurationMs(node.currentRequestIds.length);
    node.busySegmentStartMs = this.currentTimeMs;
    node.currentStepDurationMs = stepDurationMs;
    node.busyUntilMs = this.currentTimeMs + stepDurationMs;
    this.enqueue({
      timeMs: node.busyUntilMs,
      type: "decode_batch_step_complete",
      nodeId: node.id,
    });
  }

  private nextDecodeChunk(request: RequestRecord) {
    return Math.min(
      this.config.decodeTokensPerStep,
      request.outputTokensTarget - request.outputTokensProduced,
    );
  }

  private transferRequest(
    requestId: string,
    from: string,
    to: string,
    kind: TransferKind,
    tokenCount: number,
    latencyMs: number,
    arrivalType: EventType,
    nodeId?: string,
  ) {
    const transferId = `tx-${this.transferCounter++}`;
    this.transfers.set(transferId, {
      id: transferId,
      requestId,
      from,
      to,
      kind,
      tokenCount,
      startTimeMs: this.currentTimeMs,
      endTimeMs: this.currentTimeMs + latencyMs,
    });

    this.enqueue({
      timeMs: this.currentTimeMs + latencyMs,
      type: arrivalType,
      requestId,
      nodeId,
      tokenCount,
      transferId,
    });
  }

  private finishTransfer(transferId?: string) {
    if (transferId) {
      this.transfers.delete(transferId);
    }
  }

  private selectNode(kind: "prefill" | "decode", policy: DispatchPolicy) {
    const nodeIds = kind === "prefill" ? this.prefillNodeIds : this.decodeNodeIds;
    if (nodeIds.length === 1) {
      return nodeIds[0];
    }

    if (policy === "round_robin") {
      const nodeId = nodeIds[this.roundRobinCursor[kind] % nodeIds.length];
      this.roundRobinCursor[kind] += 1;
      return nodeId;
    }

    let bestNodeId = nodeIds[0];
    let bestScore =
      policy === "shortest_queue"
        ? this.shortestQueueScore(this.getNode(bestNodeId))
        : this.estimatedLoadMs(this.getNode(bestNodeId));

    for (const nodeId of nodeIds.slice(1)) {
      const node = this.getNode(nodeId);
      const score =
        policy === "shortest_queue"
          ? this.shortestQueueScore(node)
          : this.estimatedLoadMs(node);

      if (score < bestScore || (score === bestScore && nodeId < bestNodeId)) {
        bestNodeId = nodeId;
        bestScore = score;
      }
    }

    return bestNodeId;
  }

  private shortestQueueScore(node: NodeRuntime) {
    return node.queue.length + node.currentRequestIds.length;
  }

  private estimatedLoadMs(node: NodeRuntime) {
    if (node.kind === "prefill") {
      const activeResidual = node.currentRequestIds.length
        ? Math.max((node.busyUntilMs ?? this.currentTimeMs) - this.currentTimeMs, 0)
        : 0;
      let queuedDelay = 0;
      let remainingQueued = node.queue.length;

      while (remainingQueued > 0) {
        const batchSize = Math.min(remainingQueued, this.config.prefillBatchSize);
        queuedDelay += this.prefillBatchDurationMs(batchSize);
        remainingQueued -= batchSize;
      }

      return activeResidual + queuedDelay;
    }

    if (node.kind === "decode") {
      const activeResidual = node.currentRequestIds.length
        ? Math.max((node.busyUntilMs ?? this.currentTimeMs) - this.currentTimeMs, 0)
        : 0;
      const remainingSteps =
        node.currentRequestIds.reduce(
          (sum, requestId) =>
            sum + this.remainingDecodeSteps(this.getRequest(requestId)),
          0,
        ) +
        node.queue.reduce(
          (sum, requestId) =>
            sum + this.remainingDecodeSteps(this.getRequest(requestId)),
          0,
        );

      const averageBatch = Math.min(
        Math.max(node.currentRequestIds.length || 1, this.config.decodeBatchSize),
        this.config.decodeBatchSize,
      );

      return (
        activeResidual +
        Math.ceil(remainingSteps / Math.max(this.config.decodeBatchSize, 1)) *
          this.decodeBatchDurationMs(averageBatch)
      );
    }

    return 0;
  }

  private remainingDecodeSteps(request: RequestRecord) {
    return Math.ceil(
      Math.max(request.outputTokensTarget - request.outputTokensProduced, 0) /
        this.config.decodeTokensPerStep,
    );
  }

  private prefillBatchDurationMs(activeBatchSize: number) {
    return (
      this.config.prefillTimePerRequestMs +
      this.config.prefillTimeSlopeMs * activeBatchSize
    );
  }

  private decodeBatchDurationMs(activeBatchSize: number) {
    return (
      this.config.decodeStepTimeMs +
      this.config.decodeStepTimeSlopeMs * activeBatchSize
    );
  }

  private recordQueueSample(node: NodeRuntime) {
    const lastSample = node.queueSamples[node.queueSamples.length - 1];
    if (lastSample && lastSample.timeMs === this.currentTimeMs) {
      lastSample.value = node.queue.length;
      return;
    }

    node.queueSamples.push({
      timeMs: this.currentTimeMs,
      value: node.queue.length,
    });
  }

  private recordBatchSample(node: NodeRuntime) {
    const lastSample = node.batchSamples[node.batchSamples.length - 1];
    if (lastSample && lastSample.timeMs === this.currentTimeMs) {
      lastSample.value = node.currentRequestIds.length;
      return;
    }

    node.batchSamples.push({
      timeMs: this.currentTimeMs,
      value: node.currentRequestIds.length,
    });
  }

  private appendRequestEvent(
    request: RequestRecord,
    type: RequestEventType,
    label: string,
    detail?: string,
  ) {
    request.timeline.push({
      timeMs: this.currentTimeMs,
      type,
      label,
      detail,
    });
  }

  private appendSystemEvent(label: string, requestId?: string, nodeId?: string) {
    this.systemEvents.unshift({
      id: `log-${this.systemEvents.length + 1}-${this.currentTimeMs}`,
      timeMs: this.currentTimeMs,
      label,
      requestId,
      nodeId,
    });
    this.systemEvents.splice(20);
  }

  private buildNodeSnapshots(): NodeSnapshot[] {
    return [...this.nodes.values()]
      .map((node) => {
        const activeBusyMs =
          node.currentRequestIds.length > 0 && node.busySegmentStartMs !== undefined
            ? this.currentTimeMs - node.busySegmentStartMs
            : 0;

        return {
          id: node.id,
          kind: node.kind,
          queueLength: node.queue.length,
          busy: node.currentRequestIds.length > 0,
          busyUntilMs: node.busyUntilMs,
          currentStepDurationMs: node.currentStepDurationMs,
          currentRequestId: node.currentRequestIds[0],
          currentRequestIds: [...node.currentRequestIds],
          activeBatchSize: node.currentRequestIds.length,
          processedCount:
            node.kind === "client"
              ? this.clientCompletedCount
              : node.kind === "coordinator"
                ? this.coordinatorDispatchCount
                : node.processedCount,
          totalBusyTimeMs: node.totalBusyTimeMs + activeBusyMs,
          utilization:
            node.kind === "prefill" || node.kind === "decode"
              ? (node.totalBusyTimeMs + activeBusyMs) /
                Math.max(this.currentTimeMs, 1)
              : 0,
          tokenCount:
            node.kind === "client" ? this.sumTokens(this.outputEvents) : node.tokenCount,
          pendingRequestIds: [...node.queue],
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  private buildRealtimeQueueSeries() {
    const allTimes = new Set<number>([0, this.currentTimeMs]);
    const queueSamplesByNode: Record<string, TimeValueSample[]> = {};

    for (const node of this.nodes.values()) {
      if (node.kind !== "prefill" && node.kind !== "decode") {
        continue;
      }

      queueSamplesByNode[node.id] = node.queueSamples;
      for (const sample of node.queueSamples) {
        allTimes.add(sample.timeMs);
      }
    }

    return [...allTimes]
      .sort((a, b) => a - b)
      .map((timeMs) => {
        const point: QueueSeriesPoint = { timeMs };
        for (const [nodeId, samples] of Object.entries(queueSamplesByNode)) {
          let value = samples[0]?.value ?? 0;
          for (const sample of samples) {
            if (sample.timeMs > timeMs) {
              break;
            }
            value = sample.value;
          }
          point[nodeId] = value;
        }
        return point;
      });
  }

  private buildRealtimeBatchSeries() {
    const allTimes = new Set<number>([0, this.currentTimeMs]);
    const batchSamplesByNode: Record<string, TimeValueSample[]> = {};

    for (const node of this.nodes.values()) {
      if (node.kind !== "prefill" && node.kind !== "decode") {
        continue;
      }

      batchSamplesByNode[node.id] = node.batchSamples;
      for (const sample of node.batchSamples) {
        allTimes.add(sample.timeMs);
      }
    }

    return [...allTimes]
      .sort((a, b) => a - b)
      .map((timeMs) => {
        const point: QueueSeriesPoint = { timeMs };
        for (const [nodeId, samples] of Object.entries(batchSamplesByNode)) {
          let value = samples[0]?.value ?? 0;
          for (const sample of samples) {
            if (sample.timeMs > timeMs) {
              break;
            }
            value = sample.value;
          }
          point[nodeId] = value;
        }
        return point;
      });
  }

  private captureSample() {
    const elapsedSeconds = Math.max(this.currentTimeMs / 1000, 0.001);
    const point: MetricSeriesPoint = {
      timeMs: this.currentTimeMs,
      inputThroughput: this.sumTokens(this.inputEvents) / elapsedSeconds,
      outputThroughput: this.sumTokens(this.outputEvents) / elapsedSeconds,
      requestThroughput: this.completionEvents.length / elapsedSeconds,
      inputTokens: this.sumTokens(this.inputEvents),
      outputTokens: this.sumTokens(this.outputEvents),
      completedRequests: this.completionEvents.length,
    };

    const lastPoint = this.realtimeSeries[this.realtimeSeries.length - 1];
    if (lastPoint && lastPoint.timeMs === point.timeMs) {
      this.realtimeSeries[this.realtimeSeries.length - 1] = point;
      return;
    }

    this.realtimeSeries.push(point);
  }

  private sumTokens(events: Array<{ timeMs: number; tokens: number }>) {
    return events.reduce((sum, event) => sum + event.tokens, 0);
  }

  private getRequest(requestId: string) {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Request ${requestId} not found`);
    }
    return request;
  }

  private getNode(nodeId: string) {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }
    return node;
  }
}
