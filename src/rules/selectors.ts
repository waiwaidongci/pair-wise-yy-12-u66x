import { closureCheck } from "./engine";
import { HOOF_LABEL, RISK_LABEL } from "./constants";
import type {
  ArchiveState,
  HoofArchive,
  HoofCode,
  ShoeingTask,
} from "./types";

// ---------- 日期（本地时区 yyyy-MM-dd） ----------

export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayString(): string {
  return toDateString(new Date());
}

export function addDays(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

/** 距今天的天数差：负数为已过期 */
export function daysUntil(dateStr: string): number {
  const target = new Date(`${dateStr}T00:00:00`).getTime();
  const today = new Date(`${todayString()}T00:00:00`).getTime();
  return Math.round((target - today) / 86_400_000);
}

// ---------- 提醒派生：列表 / 提醒 / 刷新后保持一致 ----------

export type ReminderKind = "overdue" | "dueSoon" | "admission";

export interface ReminderItem {
  kind: ReminderKind;
  key: string;
  horseId: string;
  hoof: HoofCode;
  taskId: string;
  title: string;
  detail: string;
  daysLeft: number;
}

export const DUE_SOON_DAYS = 3;

/**
 * 提醒来源：
 * - 所有在办任务（open / recheck）都有复查日
 * - overdue：复查日已过
 * - dueSoon：复查日临近（3 天内，含今天）
 * - admission：复查准入未闭环（另一位蹄铁师两次稳定 + 蹄底照片未齐）
 */
export function selectReminders(state: ArchiveState): ReminderItem[] {
  const items: ReminderItem[] = [];
  for (const archive of state.archives) {
    for (const task of archive.tasks) {
      if (task.status !== "open" && task.status !== "recheck") continue;
      if (!task.recheckDate) continue;
      const left = daysUntil(task.recheckDate);

      if (task.status === "recheck") {
        const check = closureCheck(task);
        if (!check.canClose) {
          items.push({
            kind: "admission",
            key: archive.key,
            horseId: archive.horseId,
            hoof: archive.hoof,
            taskId: task.id,
            title: `${archive.horseId} · ${HOOF_LABEL[archive.hoof]} 复查准入未闭环`,
            detail: `风险：${task.riskFlags.map((f) => RISK_LABEL[f]).join("、")}；${check.reasons.join("；")}`,
            daysLeft: left,
          });
        }
      }

      if (left < 0) {
        items.push({
          kind: "overdue",
          key: archive.key,
          horseId: archive.horseId,
          hoof: archive.hoof,
          taskId: task.id,
          title: `${archive.horseId} · ${HOOF_LABEL[archive.hoof]} 复查已逾期`,
          detail: `复查日 ${task.recheckDate}，已逾期 ${-left} 天`,
          daysLeft: left,
        });
      } else if (left <= DUE_SOON_DAYS) {
        items.push({
          kind: "dueSoon",
          key: archive.key,
          horseId: archive.horseId,
          hoof: archive.hoof,
          taskId: task.id,
          title: `${archive.horseId} · ${HOOF_LABEL[archive.hoof]} 复查临近`,
          detail: left === 0 ? "今天复查" : `${left} 天后复查（${task.recheckDate}）`,
          daysLeft: left,
        });
      }
    }
  }

  const rank: Record<ReminderKind, number> = { overdue: 0, admission: 1, dueSoon: 2 };
  return items.sort((a, b) => rank[a.kind] - rank[b.kind] || a.daysLeft - b.daysLeft);
}

export interface Metrics {
  recheck: number;
  abnormalGait: number;
  replaced: number;
  horses: number;
}

export function selectMetrics(state: ArchiveState): Metrics {
  const horses = new Set<string>();
  let recheck = 0;
  let abnormalGait = 0;
  let replaced = 0;
  for (const archive of state.archives) {
    horses.add(archive.horseId);
    for (const task of archive.tasks) {
      if (task.status === "recheck" || task.status === "superseded") {
        if (task.status === "recheck") recheck += 1;
        if (task.riskFlags.length > 0) abnormalGait += 1;
      }
      if (task.status === "superseded") replaced += 1;
    }
  }
  return { recheck, abnormalGait, replaced, horses: horses.size };
}

export interface ArchiveListItem {
  key: string;
  horseId: string;
  hoof: HoofCode;
  active?: ShoeingTask;
  taskCount: number;
  updatedAt: string;
}

export function selectArchiveList(state: ArchiveState): ArchiveListItem[] {
  return state.archives
    .map((a: HoofArchive) => {
      const active = a.tasks.find((t) => t.status === "open")
        ?? a.tasks.find((t) => t.status === "recheck");
      const timestamps = a.tasks.flatMap((t) => [
        t.startedAt,
        t.endedAt ?? "",
        t.closedAt ?? "",
        t.supersededAt ?? "",
      ]);
      return {
        key: a.key,
        horseId: a.horseId,
        hoof: a.hoof,
        active,
        taskCount: a.tasks.length,
        updatedAt: timestamps.sort().pop() ?? a.createdAt,
      };
    })
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}
