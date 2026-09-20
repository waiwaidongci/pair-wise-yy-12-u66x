/**
 * 规则模块：蹄位更换与复查准入闭环的纯领域规则。
 * 不依赖 React / localStorage，方便测试与复用。
 */

// ---------- 基础字典 ----------

export type HoofCode = "LF" | "RF" | "LH" | "RH";
export type HoofAxle = "front" | "hind";

export interface HoofPosition {
  code: HoofCode;
  label: string;
  axle: HoofAxle;
}

export const HOOF_POSITIONS: HoofPosition[] = [
  { code: "LF", label: "左前蹄", axle: "front" },
  { code: "RF", label: "右前蹄", axle: "front" },
  { code: "LH", label: "左后蹄", axle: "hind" },
  { code: "RH", label: "右后蹄", axle: "hind" },
];

export const HOOF_LABEL: Record<HoofCode, string> = {
  LF: "左前蹄",
  RF: "右前蹄",
  LH: "左后蹄",
  RH: "右后蹄",
};

/** 风险情形：蹄裂、挫伤、明显跛行，命中任一项即转复查 */
export type RiskFlag = "crack" | "bruise" | "lame";

export const RISK_FLAGS: { key: RiskFlag; label: string }[] = [
  { key: "crack", label: "蹄裂" },
  { key: "bruise", label: "挫伤" },
  { key: "lame", label: "明显跛行" },
];

export const RISK_LABEL: Record<RiskFlag, string> = {
  crack: "蹄裂",
  bruise: "挫伤",
  lame: "明显跛行",
};

export type HorseCategory = "sport" | "rest";
export const HORSE_CATEGORY_LABEL: Record<HorseCategory, string> = {
  sport: "运动马",
  rest: "休养马",
};

/** 任务状态：未结束修蹄 → 待复查 →（闭环｜旧结论失效） */
export type TaskStatus = "in_progress" | "in_review" | "closed" | "void";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  in_progress: "未结束修蹄",
  in_review: "待复查",
  closed: "已闭环",
  void: "旧结论失效",
};

// ---------- 档案实体 ----------

export interface SolePhoto {
  id: string;
  name: string;
  /** 压缩后的 dataURL，保证刷新后仍可查看 */
  dataUrl: string;
  uploadedAt: string;
}

export interface ReviewConfirmation {
  id: string;
  at: string;
  /** 确认人，必须不同于本任务开工蹄铁师 */
  farrier: string;
  stable: boolean;
  note?: string;
}

export interface HistoryEvent {
  id: string;
  at: string;
  by: string;
  type: "start" | "save" | "review" | "photo" | "close" | "reshoe";
  detail: string;
}

export interface TrimmingTask {
  id: string;
  /** 马匹编号 + 蹄位：同一时刻只允许有一条未结束档案 */
  horseNo: string;
  horseCategory: HorseCategory;
  hoof: HoofCode;
  /** 开工蹄铁师（复查确认人必须与之不同） */
  farrier: string;
  status: TaskStatus;
  startedAt: string; // 开工 / 修蹄日期 yyyy-mm-dd
  shoeType?: string; // 蹄铁类型
  gaitIssue?: string; // 步态问题（保存必填）
  abnormalGait: boolean; // 异常步态标记
  hoofAssessment?: string; // 蹄形评估（保存必填）
  nailPositions?: string; // 钉位（保存必填）
  riskFlags: RiskFlag[];
  nextReviewDate?: string; // 下次复查日（保存必填）
  solePhotos: SolePhoto[];
  confirmations: ReviewConfirmation[];
  conclusion?: string;
  closedAt?: string;
  /** 闭环前换蹄铁：旧档案指向接替它的新档案 */
  supersededBy?: string;
  events: HistoryEvent[];
}

// ---------- 保存校验：四项缺一项不得保存 ----------

export interface RecordDraft {
  horseCategory: HorseCategory;
  farrier: string;
  shoeType: string;
  gaitIssue: string;
  abnormalGait: boolean;
  hoofAssessment: string;
  nailPositions: string;
  riskFlags: RiskFlag[];
  nextReviewDate: string;
}

export type RequiredDraftField =
  | "gaitIssue"
  | "hoofAssessment"
  | "nailPositions"
  | "nextReviewDate";

export const REQUIRED_FIELD_LABEL: Record<RequiredDraftField, string> = {
  gaitIssue: "步态问题",
  hoofAssessment: "蹄形评估",
  nailPositions: "钉位",
  nextReviewDate: "复查日",
};

export function emptyDraft(): RecordDraft {
  return {
    horseCategory: "sport",
    farrier: "",
    shoeType: "",
    gaitIssue: "",
    abnormalGait: false,
    hoofAssessment: "",
    nailPositions: "",
    riskFlags: [],
    nextReviewDate: "",
  };
}

export function draftFromTask(task: TrimmingTask): RecordDraft {
  return {
    horseCategory: task.horseCategory,
    farrier: task.farrier,
    shoeType: task.shoeType ?? "",
    gaitIssue: task.gaitIssue ?? "",
    abnormalGait: task.abnormalGait,
    hoofAssessment: task.hoofAssessment ?? "",
    nailPositions: task.nailPositions ?? "",
    riskFlags: [...task.riskFlags],
    nextReviewDate: task.nextReviewDate ?? "",
  };
}

/** 返回缺失字段；为空数组表示四项齐全，可以保存 */
export function validateDraft(draft: RecordDraft): RequiredDraftField[] {
  const missing: RequiredDraftField[] = [];
  (["gaitIssue", "hoofAssessment", "nailPositions"] as const).forEach((field) => {
    if (!draft[field].trim()) missing.push(field);
  });
  if (!draft.nextReviewDate) missing.push("nextReviewDate");
  return missing;
}

// ---------- 状态流转 ----------

export const OPEN_STATUSES: TaskStatus[] = ["in_progress", "in_review"];

export function isOpen(status: TaskStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

export function taskKey(horseNo: string, hoof: HoofCode): string {
  return `${horseNo.trim().toUpperCase()}@${hoof}`;
}

/** 同一马匹编号 + 蹄位下的未结束修蹄；存在则重复开工只沿用原任务 */
export function findOpenTask(
  tasks: readonly TrimmingTask[],
  horseNo: string,
  hoof: HoofCode,
): TrimmingTask | undefined {
  const key = taskKey(horseNo, hoof);
  return tasks.find((t) => taskKey(t.horseNo, t.hoof) === key && isOpen(t.status));
}

export function hasRisk(task: Pick<TrimmingTask, "riskFlags">): boolean {
  return task.riskFlags.length > 0;
}

export function newId(prefix = "T"): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

export function event(
  type: HistoryEvent["type"],
  by: string,
  detail: string,
  at: string,
): HistoryEvent {
  return { id: newId("E"), at, by, type, detail };
}

/** 开工：已有未结束任务时沿用，不产生新档案 */
export function startOrReuse(
  tasks: readonly TrimmingTask[],
  input: {
    horseNo: string;
    hoof: HoofCode;
    horseCategory: HorseCategory;
    farrier: string;
    startedAt: string;
  },
): { tasks: TrimmingTask[]; task: TrimmingTask; reused: boolean } {
  const existing = findOpenTask(tasks, input.horseNo, input.hoof);
  if (existing) {
    return { tasks: [...tasks], task: existing, reused: true };
  }
  const task: TrimmingTask = {
    id: newId(),
    horseNo: input.horseNo.trim().toUpperCase(),
    horseCategory: input.horseCategory,
    hoof: input.hoof,
    farrier: input.farrier.trim(),
    status: "in_progress",
    startedAt: input.startedAt,
    abnormalGait: false,
    riskFlags: [],
    solePhotos: [],
    confirmations: [],
    events: [event("start", input.farrier.trim() || "蹄铁师", "开立修蹄任务", input.startedAt)],
  };
  return { tasks: [...tasks, task], task, reused: false };
}

/** 保存记录：四项校验由调用方先跑 validateDraft；命中风险标记转复查，否则正常闭环 */
export function applySave(
  task: TrimmingTask,
  draft: RecordDraft,
  at: string,
): TrimmingTask {
  const nextStatus: TaskStatus = draft.riskFlags.length > 0 ? "in_review" : "closed";
  const riskText =
    draft.riskFlags.length > 0
      ? `；命中${draft.riskFlags.map((r) => RISK_LABEL[r]).join("、")}，转复查准入`
      : "";
  return {
    ...task,
    horseCategory: draft.horseCategory,
    farrier: draft.farrier.trim() || task.farrier,
    shoeType: draft.shoeType.trim() || undefined,
    gaitIssue: draft.gaitIssue.trim(),
    abnormalGait: draft.abnormalGait,
    hoofAssessment: draft.hoofAssessment.trim(),
    nailPositions: draft.nailPositions.trim(),
    riskFlags: [...draft.riskFlags],
    nextReviewDate: draft.nextReviewDate,
    status: nextStatus,
    closedAt: nextStatus === "closed" ? at : undefined,
    conclusion:
      nextStatus === "closed"
        ? "四项记录齐全，无蹄裂/挫伤/明显跛行，修蹄完成归档。"
        : undefined,
    events: [
      ...task.events,
      event(
        "save",
        draft.farrier.trim() || task.farrier,
        `保存修蹄记录（蹄铁：${draft.shoeType.trim() || "未填"}，钉位：${
          draft.nailPositions.trim()
        }，复查日：${draft.nextReviewDate}）${riskText}`,
        at,
      ),
    ],
  };
}

/** 闭环前换蹄铁：旧结论失效但历史留档，并生成接替的新任务 */
export function applyReshoe(
  tasks: readonly TrimmingTask[],
  oldTask: TrimmingTask,
  at: string,
  farrier: string = oldTask.farrier,
): { tasks: TrimmingTask[]; newTask: TrimmingTask } {
  const nextFarrier = (farrier ?? oldTask.farrier).trim() || oldTask.farrier;
  const newTask: TrimmingTask = {
    id: newId(),
    horseNo: oldTask.horseNo,
    horseCategory: oldTask.horseCategory,
    hoof: oldTask.hoof,
    farrier: nextFarrier,
    status: "in_progress",
    startedAt: at,
    abnormalGait: false,
    riskFlags: [],
    solePhotos: [],
    confirmations: [],
    events: [
      event(
        "start",
        nextFarrier,
        `闭环前更换蹄铁，由旧档案 ${oldTask.id} 转入；旧档案结论失效、历史留档`,
        at,
      ),
    ],
  };
  const voided: TrimmingTask = {
    ...oldTask,
    status: "void",
    closedAt: undefined,
    conclusion: undefined,
    supersededBy: newTask.id,
    events: [
      ...oldTask.events,
      event(
        "reshoe",
        nextFarrier,
        `闭环前更换蹄铁，既有复查结论与确认记录全部失效，档案留档；新任务 ${newTask.id}`,
        at,
      ),
    ],
  };
  // 同 id 替换为失效版（旧档案可能仍在任务列表中），再追加接替任务
  const exists = tasks.some((t) => t.id === oldTask.id);
  const nextTasks = exists
    ? tasks.map((t) => (t.id === oldTask.id ? voided : t))
    : [...tasks, voided];
  return { tasks: [...nextTasks, newTask], newTask };
}

/** 追加一次复查确认；确认人必须是另一位蹄铁师 */
export function applyConfirmation(
  task: TrimmingTask,
  input: { farrier: string; stable: boolean; note?: string; at: string },
): TrimmingTask {
  const farrier = input.farrier.trim();
  const confirmation: ReviewConfirmation = {
    id: newId("C"),
    at: input.at,
    farrier,
    stable: input.stable,
    note: input.note?.trim() || undefined,
  };
  return {
    ...task,
    confirmations: [...task.confirmations, confirmation],
    events: [
      ...task.events,
      event(
        "review",
        farrier,
        `第 ${task.confirmations.length + 1} 次复查确认：${
          input.stable ? "状态稳定" : "尚不稳定，连续稳定计数重置"
        }${input.note?.trim() ? `（${input.note.trim()}）` : ""}`,
        input.at,
      ),
    ],
  };
}

export function confirmationFarrierError(task: TrimmingTask, farrier: string): string | null {
  const name = farrier.trim();
  if (!name) return "请填写复查蹄铁师姓名";
  if (name === task.farrier.trim()) {
    return `复查确认须由另一位蹄铁师执行（开工蹄铁师：${task.farrier}）`;
  }
  return null;
}

/** 闭环准入：另一位蹄铁师连续两次确认稳定 + 蹄底照片补齐 */
export function closureBlockers(task: TrimmingTask): string[] {
  const blockers: string[] = [];
  if (task.status !== "in_review") {
    blockers.push("当前不在待复查状态，无需复查闭环");
    return blockers;
  }
  if (!hasRisk(task)) blockers.push("缺少蹄裂/挫伤/明显跛行标记");
  if (task.solePhotos.length === 0) blockers.push("尚未补齐蹄底照片");

  const confs = task.confirmations;
  const lastTwo = confs.slice(-2);
  if (lastTwo.length < 2 || !lastTwo.every((c) => c.stable)) {
    blockers.push("需要另一位蹄铁师连续两次确认稳定（出现一次不稳定即重新计数）");
  } else {
    const owner = task.farrier.trim();
    const other = lastTwo[0].farrier.trim();
    if (lastTwo.some((c) => c.farrier.trim() === owner)) {
      blockers.push("两次确认都必须由不同于开工蹄铁师的另一位蹄铁师完成");
    } else if (lastTwo[1].farrier.trim() !== other) {
      blockers.push("连续两次稳定须由同一位蹄铁师确认");
    }
  }
  return blockers;
}

export function canClose(task: TrimmingTask): boolean {
  return closureBlockers(task).length === 0;
}

export function applyClose(
  task: TrimmingTask,
  at: string,
  farrier: string,
): TrimmingTask {
  return {
    ...task,
    status: "closed",
    closedAt: at,
    conclusion: `两次复查确认稳定（确认人：${
      task.confirmations.slice(-2)[0].farrier
    }），蹄底照片已归档，准予闭环。`,
    events: [
      ...task.events,
      event("close", farrier, "复查准入通过，蹄位档案闭环", at),
    ],
  };
}

export function applyPhoto(task: TrimmingTask, photo: SolePhoto): TrimmingTask {
  return {
    ...task,
    solePhotos: [...task.solePhotos, photo],
    events: [
      ...task.events,
      event("photo", task.farrier, `补充蹄底照片：${photo.name}`, photo.uploadedAt),
    ],
  };
}

// ---------- 派生：指标 / 提醒 ----------

export interface DashboardMetrics {
  review: number;
  abnormalGait: number;
  reshoe: number;
  horses: number;
}

export function getMetrics(tasks: readonly TrimmingTask[]): DashboardMetrics {
  const live = tasks.filter((t) => t.status !== "void");
  const horses = new Set(live.map((t) => t.horseNo));
  return {
    review: live.filter((t) => t.status === "in_review").length,
    abnormalGait: live.filter((t) => t.abnormalGait || t.riskFlags.includes("lame")).length,
    reshoe: tasks.filter((t) => t.supersededBy).length,
    horses: horses.size,
  };
}

export type ReminderLevel = "overdue" | "today" | "soon" | "scheduled";

export interface Reminder {
  taskId: string;
  horseNo: string;
  hoof: HoofCode;
  level: ReminderLevel;
  reviewDate: string;
  days: number;
  reason: string;
}

export const REMINDER_LABEL: Record<ReminderLevel, string> = {
  overdue: "已逾期",
  today: "今日复查",
  soon: "临近复查",
  scheduled: "复查排期中",
};

export function dayDiff(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + "T00:00:00").getTime();
  const b = new Date(toISO + "T00:00:00").getTime();
  return Math.round((b - a) / 86_400_000);
}

export function buildReminders(
  tasks: readonly TrimmingTask[],
  today: string,
): Reminder[] {
  // 每个马匹+蹄位只保留最新一条，用于判断已闭环档案是否还需要提醒
  const latestByKey = new Map<string, TrimmingTask>();
  [...tasks]
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .forEach((t) => latestByKey.set(taskKey(t.horseNo, t.hoof), t));

  const reminders: Reminder[] = [];
  for (const t of tasks) {
    if (t.status === "void" || !t.nextReviewDate) continue;
    const days = dayDiff(today, t.nextReviewDate);

    if (t.status === "in_review") {
      const level: ReminderLevel =
        days < 0 ? "overdue" : days === 0 ? "today" : days <= 7 ? "soon" : "scheduled";
      reminders.push({
        taskId: t.id,
        horseNo: t.horseNo,
        hoof: t.hoof,
        level,
        reviewDate: t.nextReviewDate,
        days,
        reason: `命中${t.riskFlags.map((r) => RISK_LABEL[r]).join("、")}，等待另一位蹄铁师两次稳定确认`,
      });
    } else if (t.status === "in_progress" && days <= 7) {
      reminders.push({
        taskId: t.id,
        horseNo: t.horseNo,
        hoof: t.hoof,
        level: days <= 0 ? "overdue" : days === 0 ? "today" : "soon",
        reviewDate: t.nextReviewDate,
        days,
        reason: "修蹄尚未结束，复查日已临近，请补齐四项记录并保存",
      });
    } else if (t.status === "closed" && latestByKey.get(taskKey(t.horseNo, t.hoof)) === t && days <= 7) {
      reminders.push({
        taskId: t.id,
        horseNo: t.horseNo,
        hoof: t.hoof,
        level: days < 0 ? "overdue" : days === 0 ? "today" : "soon",
        reviewDate: t.nextReviewDate,
        days,
        reason: "到期待复查 / 评估更换蹄铁",
      });
    }
  }

  const order: Record<ReminderLevel, number> = { overdue: 0, today: 1, soon: 2, scheduled: 3 };
  return reminders.sort(
    (a, b) => order[a.level] - order[b.level] || a.reviewDate.localeCompare(b.reviewDate),
  );
}

// ---------- 日期工具 ----------

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function offsetISO(days: number, base: string = todayISO()): string {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toISODate(d);
}
