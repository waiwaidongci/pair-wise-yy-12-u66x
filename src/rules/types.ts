// 蹄位更换与复查准入闭环 —— 领域模型类型定义

/** 蹄位：左前 / 右前 / 左后 / 右后 */
export type HoofCode = "LF" | "RF" | "LH" | "RH";

/** 转复查风险项：蹄裂 / 挫伤 / 明显跛行 */
export type RiskFlag = "crack" | "bruise" | "lameness";

/**
 * 修蹄任务状态：
 * - open       修蹄中（未结束修蹄，重复开工沿用本任务）
 * - recheck    已结束修蹄、转入复查准入（两次确认 + 蹄底照片后才能闭环）
 * - closed     已闭环
 * - superseded 闭环前换蹄铁，旧结论失效但历史留档
 */
export type TaskStatus = "open" | "recheck" | "closed" | "superseded";

export type EventType =
  | "start"
  | "save"
  | "recheck"
  | "confirm"
  | "photo"
  | "supersede"
  | "close";

export interface TaskEvent {
  id: string;
  at: string;
  type: EventType;
  text: string;
}

export interface HoofPhoto {
  id: string;
  name: string;
  /** sole = 蹄底照片（复查闭环必需） */
  kind: "sole" | "other";
  dataUrl: string;
  at: string;
}

export interface RecheckConfirmation {
  id: string;
  /** 复查蹄铁师：必须不同于主修蹄铁师，且两次须为同一人 */
  farrier: string;
  /** 本次是否确认稳定；false 会使连续稳定计数清零 */
  stable: boolean;
  at: string;
  note?: string;
}

export interface ShoeingTask {
  id: string;
  horseId: string;
  hoof: HoofCode;
  /** 主修 / 开工蹄铁师 */
  farrier: string;
  startedAt: string;
  endedAt?: string;
  closedAt?: string;
  supersededAt?: string;

  shoeType?: string;
  /** 步态问题（必填） */
  gaitIssue?: string;
  /** 蹄形评估（必填） */
  hoofShape?: string;
  /** 钉位（必填） */
  nailPositions?: string;
  /** 下次复查日 yyyy-MM-dd（必填） */
  recheckDate?: string;

  riskFlags: RiskFlag[];
  photos: HoofPhoto[];
  confirmations: RecheckConfirmation[];

  status: TaskStatus;
  events: TaskEvent[];
}

/** 一匹马 + 一个蹄位 = 唯一档案 */
export interface HoofArchive {
  /** `${马匹编号}|${蹄位}`，唯一键 */
  key: string;
  horseId: string;
  hoof: HoofCode;
  tasks: ShoeingTask[];
  createdAt: string;
}

export interface ArchiveState {
  version: number;
  archives: HoofArchive[];
}
