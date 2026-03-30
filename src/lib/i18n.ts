import type {
  ArrivalPattern,
  PlaybackState,
  RequestEventType,
  RequestStatus,
} from "@/types/simulation";

export type UiLocale = "en" | "zh-CN";

export const UI_LOCALE_OPTIONS: Array<{ value: UiLocale; label: string }> = [
  { value: "en", label: "English" },
  { value: "zh-CN", label: "简体中文" },
];

export function isChineseLocale(locale: UiLocale) {
  return locale === "zh-CN";
}

export function formatLocaleDateTime(value: string, locale: UiLocale) {
  return new Date(value).toLocaleString(
    locale === "zh-CN" ? "zh-CN" : "en-US",
  );
}

export function translatePlaybackState(
  state: PlaybackState,
  locale: UiLocale,
) {
  if (locale === "zh-CN") {
    switch (state) {
      case "running":
        return "运行中";
      case "finished":
        return "已完成";
      case "paused":
        return "已暂停";
      default:
        return "空闲";
    }
  }

  switch (state) {
    case "running":
      return "RUNNING";
    case "finished":
      return "FINISHED";
    case "paused":
      return "PAUSED";
    default:
      return "IDLE";
  }
}

export function translateNodeKind(kind: string, locale: UiLocale) {
  if (locale === "zh-CN") {
    switch (kind) {
      case "client":
        return "客户端";
      case "coordinator":
        return "协调器";
      case "prefill":
        return "Prefill";
      case "decode":
        return "Decode";
      default:
        return kind;
    }
  }

  return kind;
}

export function translateRequestStatus(
  status: RequestStatus,
  locale: UiLocale,
) {
  if (locale === "zh-CN") {
    switch (status) {
      case "created":
        return "已创建";
      case "to_coordinator":
        return "前往协调器";
      case "queued_prefill":
        return "Prefill 排队";
      case "prefill":
        return "Prefill 中";
      case "to_decode":
        return "前往 Decode";
      case "queued_decode":
        return "Decode 排队";
      case "decode":
        return "Decode 中";
      case "streaming":
        return "流式返回中";
      case "completed":
        return "已完成";
      default:
        return status;
    }
  }

  return status;
}

export function translateArrivalPattern(
  pattern: ArrivalPattern,
  locale: UiLocale,
) {
  if (locale === "zh-CN") {
    switch (pattern) {
      case "aisbench_request_rate":
        return "AISBench 请求速率";
      case "burst_per_sec":
        return "按秒突发";
      case "uniform_interval":
        return "等间隔";
      default:
        return pattern;
    }
  }

  return pattern;
}

export function translateRequestEventType(
  type: RequestEventType,
  locale: UiLocale,
) {
  if (locale === "zh-CN") {
    switch (type) {
      case "arrival":
        return "到达";
      case "dispatch":
        return "分发";
      case "enqueue":
        return "入队";
      case "start":
        return "开始";
      case "complete":
        return "阶段完成";
      case "stream":
        return "流式输出";
      case "finish":
        return "完成";
      default:
        return type;
    }
  }

  return type;
}
