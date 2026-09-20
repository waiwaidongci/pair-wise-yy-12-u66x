import { useState } from "react";
import { HOOF_OPTIONS } from "../rules/constants";
import { archiveKeyOf, startWork, type MutationResult } from "../rules/engine";
import type { ArchiveState, HoofCode } from "../rules/types";
import { apply } from "./actions";
import { Banner, FieldLabel } from "./components";

interface Props {
  state: ArchiveState;
  onOpened: (key: string) => void;
}

export function StartWorkPanel({ state, onOpened }: Props) {
  const [horseId, setHorseId] = useState("");
  const [hoof, setHoof] = useState<HoofCode>("LF");
  const [farrier, setFarrier] = useState("");
  const [result, setResult] = useState<MutationResult | null>(null);

  const key = horseId.trim() ? archiveKeyOf(horseId, hoof) : "";
  const existing = key ? state.archives.find((a) => a.key === key) : undefined;
  const active = existing?.tasks.find((t) => t.status === "open" || t.status === "recheck");

  function submit() {
    const res = startWork(state, { horseId, hoof, farrier });
    setResult(res);
    if (apply(res) && res.taskId) onOpened(res.archiveKey);
  }

  return (
    <div className="panel side-panel">
      <div className="panel-title">
        <p>蹄位更换</p>
        <h2>开工 / 换蹄铁</h2>
      </div>

      <div className="form-stack">
        <label>
          <FieldLabel required>马匹编号</FieldLabel>
          <input
            value={horseId}
            placeholder="如 HORSE-18"
            onChange={(e) => setHorseId(e.target.value)}
          />
        </label>
        <label>
          <FieldLabel required>蹄位（编号 + 蹄位唯一）</FieldLabel>
          <select value={hoof} onChange={(e) => setHoof(e.target.value as HoofCode)}>
            {HOOF_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <FieldLabel required>蹄铁师</FieldLabel>
          <input
            value={farrier}
            placeholder="本次开工蹄铁师姓名"
            onChange={(e) => setFarrier(e.target.value)}
          />
        </label>
      </div>

      {active && (
        <Banner kind={active.status === "open" ? "info" : "error"}>
          {active.status === "open"
            ? `该蹄位存在未结束修蹄（${active.farrier} 开工），重复开工只沿用原任务，不新建。`
            : "该蹄位复查尚未闭环：开工将换新蹄铁，旧复查结论作废但历史留档。"}
        </Banner>
      )}
      {existing && !active && (
        <Banner kind="info">该蹄位已有历史档案 {existing.tasks.length} 条，开工将在同一档案下新增任务。</Banner>
      )}

      {result && result.errors.length > 0 && (
        <Banner kind="error">请填写：{result.errors.join("、")}</Banner>
      )}
      {result && result.errors.length === 0 && (
        <Banner kind="success">
          {result.reused
            ? "已沿用未结束的原任务。"
            : result.superseded
              ? "旧复查结论已作废留档，新修蹄任务已开工。"
              : "新修蹄任务已开工。"}
        </Banner>
      )}

      <button className="primary full" onClick={submit}>
        开工
      </button>
    </div>
  );
}
