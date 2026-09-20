import type { HoofCode, RiskFlag, TaskStatus } from "./types";

export const STORAGE_KEY = "farrier-archive-v1";
export const STATE_VERSION = 1;

export const HOOF_OPTIONS: { value: HoofCode; label: string; side: "前蹄" | "后蹄" }[] = [
  { value: "LF", label: "左前蹄", side: "前蹄" },
  { value: "RF", label: "右前蹄", side: "前蹄" },
  { value: "LH", label: "左后蹄", side: "后蹄" },
  { value: "RH", label: "右后蹄", side: "后蹄" },
];

export const HOOF_LABEL: Record<HoofCode, string> = {
  LF: "左前蹄",
  RF: "右前蹄",
  LH: "左后蹄",
  RH: "右后蹄",
};

export const RISK_LABEL: Record<RiskFlag, string> = {
  crack: "蹄裂",
  bruise: "挫伤",
  lameness: "明显跛行",
};

export const RISK_OPTIONS: { value: RiskFlag; label: string }[] = [
  { value: "crack", label: "蹄裂" },
  { value: "bruise", label: "挫伤" },
  { value: "lameness", label: "明显跛行" },
];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  open: "修蹄中",
  recheck: "复查中",
  closed: "已闭环",
  superseded: "旧结论失效",
};

/** 保存时缺一不可：步态问题、蹄形评估、钉位、复查日 */
export const REQUIRED_FIELDS = [
  { key: "gaitIssue", label: "步态问题" },
  { key: "hoofShape", label: "蹄形评估" },
  { key: "nailPositions", label: "钉位" },
  { key: "recheckDate", label: "复查日" },
] as const;

export type RequiredFieldKey = (typeof REQUIRED_FIELDS)[number]["key"];
