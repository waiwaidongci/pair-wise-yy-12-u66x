import type { MutationResult } from "../rules/engine";
import { getStore } from "./useArchiveStore";

/** 界面模块统一出口：规则模块判定成功后才写入存储模块 */
export function apply(result: MutationResult): boolean {
  if (result.errors.length > 0) return false;
  getStore().setState(result.state);
  return true;
}
