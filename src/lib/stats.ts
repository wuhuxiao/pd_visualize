import type {
  BucketSeriesPoint,
  QueueSeriesPoint,
  RequestMetricPoint,
  RequestRecord,
  SummaryStats,
  TimeValueSample,
} from "@/types/simulation";

function defaultSummary(): SummaryStats {
  return {
    avg: 0,
    p50: 0,
    p90: 0,
    p99: 0,
    max: 0,
    count: 0,
  };
}

function percentile(sortedValues: number[], percentileValue: number) {
  if (sortedValues.length === 0) {
    return 0;
  }

  if (sortedValues.length === 1) {
    return sortedValues[0];
  }

  const index = (sortedValues.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const fraction = index - lower;

  if (lower === upper) {
    return sortedValues[lower];
  }

  return (
    sortedValues[lower] +
    (sortedValues[upper] - sortedValues[lower]) * fraction
  );
}

export function summarize(values: number[]): SummaryStats {
  if (values.length === 0) {
    return defaultSummary();
  }

  const sorted = [...values].sort((a, b) => a - b);
  const avg = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;

  return {
    avg,
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    p99: percentile(sorted, 0.99),
    max: sorted[sorted.length - 1],
    count: sorted.length,
  };
}

export function computeRequestMetrics(
  request: RequestRecord,
): RequestMetricPoint {
  const ttftMs =
    request.firstTokenTimeMs !== undefined
      ? request.firstTokenTimeMs - request.arrivalTimeMs
      : undefined;
  const tpotMs =
    request.firstTokenTimeMs !== undefined &&
    request.lastTokenTimeMs !== undefined &&
    request.outputTokensDelivered > 1
      ? (request.lastTokenTimeMs - request.firstTokenTimeMs) /
        (request.outputTokensDelivered - 1)
      : undefined;
  const e2eLatencyMs =
    request.finishTimeMs !== undefined
      ? request.finishTimeMs - request.arrivalTimeMs
      : undefined;
  const outputTokenThroughputTokPerSec =
    tpotMs !== undefined && tpotMs > 0 ? 1000 / tpotMs : undefined;

  return {
    requestId: request.id,
    sequence: request.sequence,
    finishTimeMs: request.finishTimeMs,
    ttftMs,
    tpotMs,
    e2eLatencyMs,
    outputTokenThroughputTokPerSec,
    status: request.status,
  };
}

export function buildBucketSeries(
  durationMs: number,
  inputEvents: Array<{ timeMs: number; tokens: number }>,
  prefillEvents: Array<{ timeMs: number; tokens: number }>,
  outputEvents: Array<{ timeMs: number; tokens: number }>,
  completionEvents: number[],
): BucketSeriesPoint[] {
  const bucketCount = Math.max(1, Math.ceil(durationMs / 1000));
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    second: index,
    inputTokens: 0,
    prefillTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    completedRequests: 0,
    inputThroughput: 0,
    prefillTokenThroughput: 0,
    outputThroughput: 0,
    totalTokenThroughput: 0,
    requestThroughput: 0,
  }));

  for (const event of inputEvents) {
    const index = Math.min(bucketCount - 1, Math.floor(event.timeMs / 1000));
    buckets[index].inputTokens += event.tokens;
  }

  for (const event of outputEvents) {
    const index = Math.min(bucketCount - 1, Math.floor(event.timeMs / 1000));
    buckets[index].outputTokens += event.tokens;
  }

  for (const event of prefillEvents) {
    const index = Math.min(bucketCount - 1, Math.floor(event.timeMs / 1000));
    buckets[index].prefillTokens += event.tokens;
  }

  for (const timeMs of completionEvents) {
    const index = Math.min(bucketCount - 1, Math.floor(timeMs / 1000));
    buckets[index].completedRequests += 1;
  }

  return buckets.map((bucket) => ({
    ...bucket,
    totalTokens: bucket.inputTokens + bucket.outputTokens,
    inputThroughput: bucket.inputTokens,
    prefillTokenThroughput: bucket.prefillTokens,
    outputThroughput: bucket.outputTokens,
    totalTokenThroughput: bucket.inputTokens + bucket.outputTokens,
    requestThroughput: bucket.completedRequests,
  }));
}

function valueAtTime(samples: TimeValueSample[], timeMs: number) {
  let currentValue = samples[0]?.value ?? 0;

  for (const sample of samples) {
    if (sample.timeMs > timeMs) {
      break;
    }
    currentValue = sample.value;
  }

  return currentValue;
}

function averageValueInBucket(
  samples: TimeValueSample[],
  startMs: number,
  endMs: number,
) {
  if (samples.length === 0 || endMs <= startMs) {
    return 0;
  }

  let total = 0;
  let cursor = startMs;
  let currentValue = valueAtTime(samples, startMs);

  for (const sample of samples) {
    if (sample.timeMs <= startMs) {
      continue;
    }
    if (sample.timeMs >= endMs) {
      break;
    }

    total += currentValue * (sample.timeMs - cursor);
    cursor = sample.timeMs;
    currentValue = sample.value;
  }

  total += currentValue * (endMs - cursor);

  return total / (endMs - startMs);
}

export function buildQueueBucketSeries(
  durationMs: number,
  queueSamplesByNode: Record<string, TimeValueSample[]>,
): QueueSeriesPoint[] {
  const bucketCount = Math.max(1, Math.ceil(durationMs / 1000));
  const series: QueueSeriesPoint[] = [];

  for (let second = 0; second < bucketCount; second += 1) {
    const startMs = second * 1000;
    const endMs = Math.min(durationMs, (second + 1) * 1000);
    const point: QueueSeriesPoint = {
      timeMs: second * 1000,
    };

    for (const [nodeId, samples] of Object.entries(queueSamplesByNode)) {
      point[nodeId] = averageValueInBucket(samples, startMs, endMs);
    }

    series.push(point);
  }

  return series;
}

export function buildNodeValueBucketSeries(
  durationMs: number,
  samplesByNode: Record<string, TimeValueSample[]>,
): QueueSeriesPoint[] {
  return buildQueueBucketSeries(durationMs, samplesByNode);
}
