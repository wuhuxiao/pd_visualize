import { round } from "@/lib/utils";

export function formatMs(value?: number) {
  if (value === undefined || Number.isNaN(value)) {
    return "N/A";
  }

  if (value >= 1000) {
    return `${round(value / 1000, 2)} s`;
  }

  return `${round(value, 1)} ms`;
}

export function formatSeconds(valueMs: number) {
  return `${round(valueMs / 1000, 2)} s`;
}

export function formatThroughput(value: number, unit: "tok/s" | "req/s") {
  return `${round(value, 2)} ${unit}`;
}

export function formatPercent(value: number) {
  return `${round(value * 100, 1)}%`;
}

export function formatTokens(value: number) {
  return `${Math.round(value).toLocaleString()} tok`;
}
