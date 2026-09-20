import { REQUIRED_FIELDS } from "./constants";
import type {
  ArchiveState,
  HoofArchive,
  HoofCode,
  HoofPhoto,
  RecheckConfirmation,
  RiskFlag,
  ShoeingTask,
  TaskEvent,
  TaskStatus,
} from "./types";

// ---------- 基础工具 ----------

export interface MutationResult {
  state: ArchiveState;
  archiveKey: string;
  taskId?: string;
  /** 开工复用：是否沿用了未结束的原任务 */
  reused?: boolean;
  /** 开工导致旧复查任务结论失效 */
  superseded?: boolean;
  errors: string[];
}

export function ok(
  state: ArchiveState,
  archiveKey: string,
  taskId: string | undefined,
  extra?: { reused?: boolean; superseded?: boolean }
): MutationResult {
  return { state, archiveKey, taskId, errors: [], ...extra };
}

export function fail(errors: string[]): MutationResult {
  return {
    state: { version: 0, archives: [] },
    archiveKey: "",
    errors,
  };
}

/** 马匹编号 + 蹄位唯一键（编号大小写/空格归一化） */
export function archiveKeyOf(horseId: string, hoof: HoofCode): string {
  return `${normalizeHorseId(horseId)}|${hoof}`;
}

export function normalizeHorseId(horseId: string): string {
  return horseId.trim().toUpperCase();
}

let seq = 0;
export function uid(prefix: string): string {
  seq = (seq + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}_${seq.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function clone(state: ArchiveState): ArchiveState {
  return JSON.parse(JSON.stringify(state)) as ArchiveState;
}

function event(type: TaskEvent["type"], text: string): TaskEvent {
  return { id: uid("ev"), at: new Date().toISOString(), type, text };
}

function findArchive(state: ArchiveState, key: string) {
  return state.archives.find((a) => a.key === key);
}

function findTask(archive: HoofArchive, taskId: string) {
  const index = archive.tasks.findIndex((t) => t.id === taskId);
  return { index, task: index >= 0 ? archive.tasks[index] : undefined };
}

// ---------- 必填校验 ----------

export function missingRequiredFields(task: Partial<ShoeingTask>): string[] {
  const missing: string[] = [];
  for (const field of REQUIRED_FIELDS) {
    const value = task[field.key];
    if (typeof value !== "string" || value.trim() === "") {
      missing.push(field.label);
    }
  }
  if (
    task.recheckDate &&
    !/^\d{4}-\d{2}-\d{2}$/.test(task.recheckDate.trim())
  ) {
    missing.push("复查日格式");
  }
  return missing;
}

// ---------- 开工：唯一性 + 未结束任务沿用 ----------

export interface StartWorkInput {
  horseId: string;
  hoof: HoofCode;
  farrier: string;
}

/**
 * 开工规则：
 * - 马匹编号 + 蹄位唯一
 * - 存在未结束修蹄（open）时，重复开工只沿用原任务，不新建
 * - 存在复查中（recheck）任务时，闭环前换蹄铁：旧结论失效但历史留档，再开新任务
 */
export function startWork(prev: ArchiveState, input: StartWorkInput): MutationResult {
  const errors: string[] = [];
  if (!input.horseId.trim()) errors.push("马匹编号");
  if (!input.farrier.trim()) errors.push("蹄铁师姓名");
  if (errors.length) return fail(errors);

  const key = archiveKeyOf(input.horseId, input.hoof);
  const state = clone(prev);
  let archive = findArchive(state, key);

  if (archive) {
    const openTask = archive.tasks.find((t) => t.status === "open");
    if (openTask) {
      // 未结束修蹄存在：重复开工只沿用原任务
      openTask.events.push(event("start", `${input.farrier.trim()} 再次开工，沿用未结束任务`));
      return ok(state, key, openTask.id, { reused: true });
    }

    const recheckTask = archive.tasks.find((t) => t.status === "recheck");
    let superseded = false;
    if (recheckTask) {
      // 闭环前换蹄铁：旧结论失效，但历史留档
      recheckTask.status = "superseded";
      recheckTask.supersededAt = new Date().toISOString();
      recheckTask.events.push(
        event(
          "supersede",
          `闭环前换蹄铁，复查结论作废（历史保留）；新修蹄由 ${input.farrier.trim()} 开工`
        )
      );
      superseded = true;
    }

    const task = newTask(input);
    archive.tasks.push(task);
    return ok(state, key, task.id, { superseded });
  }

  archive = {
    key,
    horseId: normalizeHorseId(input.horseId),
    hoof: input.hoof,
    createdAt: new Date().toISOString(),
    tasks: [newTask(input)],
  };
  state.archives.push(archive);
  return ok(state, key, archive.tasks[0].id);
}

function newTask(input: StartWorkInput): ShoeingTask {
  return {
    id: uid("task"),
    horseId: normalizeHorseId(input.horseId),
    hoof: input.hoof,
    farrier: input.farrier.trim(),
    startedAt: new Date().toISOString(),
    riskFlags: [],
    photos: [],
    confirmations: [],
    status: "open",
    events: [event("start", `${input.farrier.trim()} 开工修蹄`)],
  };
}

// ---------- 保存修蹄记录（结束修蹄） ----------

export interface SaveTaskInput {
  horseId: string;
  hoof: HoofCode;
  taskId: string;
  farrier: string;
  gaitIssue: string;
  hoofShape: string;
  shoeType: string;
  nailPositions: string;
  recheckDate: string;
  riskFlags: RiskFlag[];
  note?: string;
}

/**
 * 保存规则：步态问题、蹄形评估、钉位、复查日缺一项不得保存。
 * 勾选蹄裂 / 挫伤 / 明显跛行则转复查准入；否则正常闭环。
 */
export function saveTask(prev: ArchiveState, input: SaveTaskInput): MutationResult {
  const key = archiveKeyOf(input.horseId, input.hoof);
  const archive = findArchive(prev, key);
  if (!archive) return fail(["蹄位档案不存在，请重新开工"]);
  const { task } = findTask(archive, input.taskId);
  if (!task) return fail(["修蹄任务不存在"]);
  if (task.status !== "open") return fail(["该任务已结束，不能重复保存"]);

  const draft: Partial<ShoeingTask> = {
    gaitIssue: input.gaitIssue,
    hoofShape: input.hoofShape,
    nailPositions: input.nailPositions,
    recheckDate: input.recheckDate,
  };
  const missing = missingRequiredFields(draft);
  if (missing.length) return fail([`缺少必填项：${missing.join("、")}`]);

  const state = clone(prev);
  const target = findArchive(state, key)!;
  const { index } = findTask(target, input.taskId);
  const current = target.tasks[index];

  current.farrier = input.farrier.trim() || current.farrier;
  current.gaitIssue = input.gaitIssue.trim();
  current.hoofShape = input.hoofShape.trim();
  current.shoeType = input.shoeType.trim();
  current.nailPositions = input.nailPositions.trim();
  current.recheckDate = input.recheckDate.trim();
  current.riskFlags = [...new Set(input.riskFlags)];
  current.endedAt = new Date().toISOString();

  const toRecheck = current.riskFlags.length > 0;
  const nextStatus: TaskStatus = toRecheck ? "recheck" : "closed";
  current.status = nextStatus;
  current.events.push(
    event(
      toRecheck ? "recheck" : "save",
      toRecheck
        ? `保存并转复查准入：${current.riskFlags.map(riskName).join("、")}`
        : `修蹄记录保存完成，正常闭环（复查日 ${current.recheckDate}）`
    )
  );
  if (!toRecheck) {
    current.closedAt = current.endedAt;
    current.events.push(event("close", "无蹄裂/挫伤/明显跛行，直接闭环"));
  }
  if (input.note?.trim()) {
    current.events.push(event("save", `备注：${input.note.trim()}`));
  }
  return ok(state, key, current.id);
}

// ---------- 复查确认（另一位蹄铁师连续两次稳定） ----------

export interface ConfirmInput {
  horseId: string;
  hoof: HoofCode;
  taskId: string;
  farrier: string;
  stable: boolean;
  note?: string;
}

export function addConfirmation(prev: ArchiveState, input: ConfirmInput): MutationResult {
  const key = archiveKeyOf(input.horseId, input.hoof);
  const archive = findArchive(prev, key);
  if (!archive) return fail(["蹄位档案不存在"]);
  const { task } = findTask(archive, input.taskId);
  if (!task) return fail(["修蹄任务不存在"]);
  if (task.status !== "recheck") return fail(["仅复查中的任务可以登记复查确认"]);
  if (!input.farrier.trim()) return fail(["复查蹄铁师姓名"]);

  const farrier = input.farrier.trim();
  if (farrier === task.farrier) {
    return fail(["复查须由另一位蹄铁师确认，不能与开工蹄铁师相同"]);
  }

  const state = clone(prev);
  const current = findTask(findArchive(state, key)!, input.taskId).task!;
  const confirmation: RecheckConfirmation = {
    id: uid("cf"),
    farrier,
    stable: input.stable,
    at: new Date().toISOString(),
    note: input.note?.trim() || undefined,
  };
  current.confirmations.push(confirmation);
  current.events.push(
    event(
      "confirm",
      `${farrier} 第 ${current.confirmations.length} 次复查：${
        input.stable ? "确认稳定" : "认为不稳定，连续稳定计数清零"
      }${input.note?.trim() ? `（${input.note.trim()}）` : ""}`
    )
  );
  return ok(state, key, current.id);
}

// ---------- 蹄底照片 ----------

export interface PhotoInput {
  horseId: string;
  hoof: HoofCode;
  taskId: string;
  name: string;
  kind: HoofPhoto["kind"];
  dataUrl: string;
}

export function addPhoto(prev: ArchiveState, input: PhotoInput): MutationResult {
  const key = archiveKeyOf(input.horseId, input.hoof);
  const archive = findArchive(prev, key);
  if (!archive) return fail(["蹄位档案不存在"]);
  const { task } = findTask(archive, input.taskId);
  if (!task) return fail(["修蹄任务不存在"]);
  if (task.status === "closed") return fail(["已闭环任务不能再补照片"]);

  const state = clone(prev);
  const current = findTask(findArchive(state, key)!, input.taskId).task!;
  const photo: HoofPhoto = {
    id: uid("ph"),
    name: input.name,
    kind: input.kind,
    dataUrl: input.dataUrl,
    at: new Date().toISOString(),
  };
  current.photos.push(photo);
  current.events.push(
    event("photo", `${input.kind === "sole" ? "蹄底照片" : "现场照片"}已补齐：${input.name}`)
  );
  return ok(state, key, current.id);
}

// ---------- 闭环准入判定 ----------

/** 从最新一次确认向前数：同一复查蹄铁师连续确认稳定的次数 */
export function stableStreak(task: ShoeingTask): number {
  let streak = 0;
  for (let i = task.confirmations.length - 1; i >= 0; i--) {
    if (task.confirmations[i].stable) streak += 1;
    else break;
  }
  return streak;
}

export function recheckFarrier(task: ShoeingTask): string | undefined {
  const last = task.confirmations[task.confirmations.length - 1];
  if (!last || !last.stable) return undefined;
  // 连续稳定的确认必须来自同一位（非主修）蹄铁师
  for (let i = task.confirmations.length - 1; i >= 0; i--) {
    const c = task.confirmations[i];
    if (!c.stable) break;
    if (c.farrier !== last.farrier) return undefined;
  }
  if (last.farrier === task.farrier) return undefined;
  return last.farrier;
}

export interface ClosureCheck {
  canClose: boolean;
  reasons: string[];
  streak: number;
  farrier?: string;
  hasSolePhoto: boolean;
}

export function closureCheck(task: ShoeingTask): ClosureCheck {
  const reasons: string[] = [];
  if (task.status !== "recheck") {
    reasons.push("当前不是复查中任务");
  }
  const streak = stableStreak(task);
  const farrier = recheckFarrier(task);
  if (!farrier) {
    reasons.push("须由另一位蹄铁师连续两次确认稳定");
  } else if (streak < 2) {
    reasons.push(`连续稳定确认还差 ${2 - streak} 次`);
  }
  const hasSolePhoto = task.photos.some((p) => p.kind === "sole");
  if (!hasSolePhoto) reasons.push("须补齐蹄底照片");
  return {
    canClose: reasons.length === 0,
    reasons,
    streak,
    farrier,
    hasSolePhoto,
  };
}

export function closeTask(
  prev: ArchiveState,
  horseId: string,
  hoof: HoofCode,
  taskId: string
): MutationResult {
  const key = archiveKeyOf(horseId, hoof);
  const archive = findArchive(prev, key);
  if (!archive) return fail(["蹄位档案不存在"]);
  const { task } = findTask(archive, taskId);
  if (!task) return fail(["修蹄任务不存在"]);
  const check = closureCheck(task);
  if (!check.canClose) return fail(check.reasons);

  const state = clone(prev);
  const current = findTask(findArchive(state, key)!, taskId).task!;
  current.status = "closed";
  current.closedAt = new Date().toISOString();
  current.events.push(
    event(
      "close",
      `复查准入闭环：${check.farrier} 连续两次确认稳定，蹄底照片齐备`
    )
  );
  return ok(state, key, current.id);
}

// ---------- 查询派生 ----------

export function activeTask(archive: HoofArchive): ShoeingTask | undefined {
  // 未结束修蹄优先，其次复查中
  return archive.tasks.find((t) => t.status === "open")
    ?? archive.tasks.find((t) => t.status === "recheck");
}

function riskName(flag: RiskFlag): string {
  return flag === "crack" ? "蹄裂" : flag === "bruise" ? "挫伤" : "明显跛行";
}
