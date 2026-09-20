import { useSyncExternalStore } from "react";
import type { ArchiveState } from "../rules/types";
import { createArchiveStore, loadState, resetState, type ArchiveStore } from "../storage/store";

// 全应用单一 store：列表、提醒、详情共享同一份状态，刷新后从 localStorage 恢复
const store: ArchiveStore = createArchiveStore(loadState());

export function useArchiveState(): ArchiveState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function getStore(): ArchiveStore {
  return store;
}

export function resetDemoData(): ArchiveState {
  const seed = resetState();
  store.setState(seed);
  return seed;
}
