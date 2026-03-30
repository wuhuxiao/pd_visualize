export type DispatchPolicy =
  | "round_robin"
  | "shortest_queue"
  | "least_loaded";

export type ArrivalPattern =
  | "aisbench_request_rate"
  | "burst_per_sec"
  | "uniform_interval";

export type PlaybackState = "idle" | "running" | "paused" | "finished";

export type NodeKind = "client" | "coordinator" | "prefill" | "decode";

export type RequestStatus =
  | "created"
  | "to_coordinator"
  | "queued_prefill"
  | "prefill"
  | "to_decode"
  | "queued_decode"
  | "decode"
  | "streaming"
  | "completed";

export type RequestEventType =
  | "arrival"
  | "dispatch"
  | "enqueue"
  | "start"
  | "complete"
  | "stream"
  | "finish";

export type TransferKind = "request" | "token";

export interface SimulationConfig {
  reqPerSec: number;
  arrivalPattern: ArrivalPattern;
  clientBatchSize: number;
  maxRequestCount: number;
  inputTokensPerRequest: number;
  outputTokensPerRequest: number;
  simulationDurationSec: number;
  prefillNodeCount: number;
  decodeNodeCount: number;
  prefillBatchSize: number;
  decodeBatchSize: number;
  coordinatorDispatchPolicy: DispatchPolicy;
  prefillTimePerRequestMs: number;
  prefillTimeSlopeMs: number;
  decodeStepTimeMs: number;
  decodeStepTimeSlopeMs: number;
  decodeTokensPerStep: number;
  networkLatencyClientToCoordinatorMs: number;
  networkLatencyCoordinatorToPrefillMs: number;
  networkLatencyPrefillToDecodeMs: number;
  networkLatencyDecodeToClientMs: number;
  randomSeed: number;
}

export interface ConfigTemplate {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  config: SimulationConfig;
}

export interface RequestTimelineEvent {
  timeMs: number;
  type: RequestEventType;
  label: string;
  detail?: string;
}

export interface RequestMetrics {
  ttftMs?: number;
  tpotMs?: number;
  e2eLatencyMs?: number;
  outputTokenThroughputTokPerSec?: number;
}

export interface RequestRecord {
  id: string;
  sequence: number;
  inputTokens: number;
  outputTokensTarget: number;
  outputTokensProduced: number;
  outputTokensDelivered: number;
  arrivalTimeMs: number;
  coordinatorArrivalTimeMs?: number;
  prefillNodeId?: string;
  prefillQueueEnterTimeMs?: number;
  prefillStartTimeMs?: number;
  prefillEndTimeMs?: number;
  decodeNodeId?: string;
  decodeQueueEnterTimeMs?: number;
  decodeStartTimeMs?: number;
  firstTokenTimeMs?: number;
  lastTokenTimeMs?: number;
  finishTimeMs?: number;
  status: RequestStatus;
  metrics: RequestMetrics;
  timeline: RequestTimelineEvent[];
}

export interface TimeValueSample {
  timeMs: number;
  value: number;
}

export interface NodeSnapshot {
  id: string;
  kind: NodeKind;
  queueLength: number;
  busy: boolean;
  busyUntilMs?: number;
  currentStepDurationMs?: number;
  currentRequestId?: string;
  currentRequestIds: string[];
  activeBatchSize: number;
  processedCount: number;
  totalBusyTimeMs: number;
  utilization: number;
  tokenCount: number;
  pendingRequestIds: string[];
}

export interface TransferSnapshot {
  id: string;
  requestId: string;
  from: string;
  to: string;
  kind: TransferKind;
  tokenCount: number;
  startTimeMs: number;
  endTimeMs: number;
  progress: number;
}

export interface SummaryStats {
  avg: number;
  p50: number;
  p90: number;
  p99: number;
  max: number;
  count: number;
}

export interface MetricSeriesPoint {
  timeMs: number;
  inputThroughput: number;
  prefillTokenThroughput: number;
  outputThroughput: number;
  totalTokenThroughput: number;
  requestThroughput: number;
  inputTokens: number;
  prefillTokens: number;
  outputTokens: number;
  totalTokens: number;
  completedRequests: number;
}

export interface QueueSeriesPoint {
  timeMs: number;
  [nodeId: string]: number;
}

export interface BucketSeriesPoint {
  second: number;
  inputTokens: number;
  prefillTokens: number;
  outputTokens: number;
  totalTokens: number;
  completedRequests: number;
  inputThroughput: number;
  prefillTokenThroughput: number;
  outputThroughput: number;
  totalTokenThroughput: number;
  requestThroughput: number;
}

export interface RequestMetricPoint {
  requestId: string;
  sequence: number;
  finishTimeMs?: number;
  ttftMs?: number;
  tpotMs?: number;
  e2eLatencyMs?: number;
  outputTokenThroughputTokPerSec?: number;
  status: RequestStatus;
}

export interface SystemEvent {
  id: string;
  timeMs: number;
  label: string;
  requestId?: string;
  nodeId?: string;
}

export interface AggregateMetrics {
  benchmarkDurationMs: number;
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  activeRequests: number;
  concurrency: number;
  maxConcurrency: number;
  totalInputTokens: number;
  totalPrefillTokens: number;
  totalOutputTokens: number;
  systemInputThroughput: number;
  prefillTokenThroughput: number;
  systemOutputThroughput: number;
  totalTokenThroughput: number;
  requestThroughput: number;
  ttft: SummaryStats;
  tpot: SummaryStats;
  e2eLatency: SummaryStats;
  outputTokenThroughput: SummaryStats;
}

export interface SimulationSnapshot {
  config: SimulationConfig;
  currentTimeMs: number;
  durationMs: number;
  progress: number;
  hasStarted: boolean;
  hasFinished: boolean;
  requests: RequestRecord[];
  nodes: NodeSnapshot[];
  activeTransfers: TransferSnapshot[];
  metrics: AggregateMetrics;
  realtimeSeries: MetricSeriesPoint[];
  finalSeries: BucketSeriesPoint[];
  realtimeQueueSeries: QueueSeriesPoint[];
  finalQueueSeries: QueueSeriesPoint[];
  realtimeBatchSeries: QueueSeriesPoint[];
  finalBatchSeries: QueueSeriesPoint[];
  ttftSeries: RequestMetricPoint[];
  tpotSeries: RequestMetricPoint[];
  systemEvents: SystemEvent[];
}

export interface ControllerSnapshot extends SimulationSnapshot {
  playbackState: PlaybackState;
  speed: number;
}
