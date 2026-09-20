/**
 * 界面业务模块：把规则/存储接进 React，提供选择态与派生数据。
 */
import { useMemo, useSyncExternalStore } from "react";
import { taskStore } from "../storage/taskStore";
import {
  Reminder,
  TrimmingTask,
  buildReminders,
  getMetrics,
  todayISO,
} from "../rules";

export function useTasks(): TrimmingTask[] {
  return useSyncExternalStore(
    (fn) => taskStore.subscribe(fn),
    () => taskStore.getSnapshot(),
  );
}

export function useReminders(today: string = todayISO()): Reminder[] {
  const tasks = useTasks();
  return useMemo(() => buildReminders(tasks, today), [tasks, today]);
}

export function useMetrics() {
  const tasks = useTasks();
  return useMemo(() => getMetrics(tasks), [tasks]);
}

export function useSelectedTask(id: string | null): TrimmingTask | undefined {
  const tasks = useTasks();
  return useMemo(() => tasks.find((t) => t.id === id), [tasks, id]);
}
