import { STORAGE_KEY, STATE_VERSION } from "../rules/constants";
import type { ArchiveState } from "../rules/types";
import { buildSeedState } from "./seed";

function isValidState(value: unknown): value is ArchiveState {
  if (!value || typeof value !== "object") return false;
  const s = value as ArchiveState;
  return s.version === STATE_VERSION && Array.isArray(s.archives);
}

/** 读取持久化档案；首次访问写入演示数据，保证刷新后一致 */
export function loadState(): ArchiveState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (isValidState(parsed)) return parsed;
    }
  } catch {
    // localStorage 不可用时退回到内存态
  }
  const seed = buildSeedState();
  persistState(seed);
  return seed;
}

export function persistState(state: ArchiveState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 配额不足等异常：本次会话仍可用
  }
}

export function resetState(): ArchiveState {
  const seed = buildSeedState();
  persistState(seed);
  return seed;
}

/**
 * 单一数据源：所有变更先经规则模块纯函数计算，再统一持久化。
 * storage 事件保证多标签页之间、刷新前后列表 / 提醒 / 详情一致。
 */
export type Listener = (state: ArchiveState) => void;

export interface ArchiveStore {
  getState(): ArchiveState;
  setState(next: ArchiveState): void;
  subscribe(listener: Listener): () => void;
}

export function createArchiveStore(initial: ArchiveState): ArchiveStore {
  let state = initial;
  const listeners = new Set<Listener>();

  const notify = () => {
    listeners.forEach((listener) => listener(state));
  };

  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const parsed = JSON.parse(e.newValue) as unknown;
      if (isValidState(parsed)) {
        state = parsed;
        notify();
      }
    } catch {
      // 忽略损坏数据
    }
  };
  window.addEventListener("storage", onStorage);

  return {
    getState: () => state,
    setState(next) {
      if (next === state) return;
      state = next;
      persistState(state);
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
