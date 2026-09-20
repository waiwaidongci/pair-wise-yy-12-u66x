import { useState } from "react";
import { RISK_LABEL } from "../rules/constants";
import { addConfirmation, closeTask, closureCheck, stableStreak } from "../rules/engine";
import { formatDateTime } from "./format";
import type { HoofArchive, ShoeingTask } from "../rules/types";
import { apply } from "./actions";
import { getStore } from "./useArchiveStore";
import { Banner, FieldLabel } from "./components";

export function RecheckPanel({ archive, task }: { archive: HoofArchive; task: ShoeingTask }) {
  const [farrier, setFarrier] = useState("");
  const [stable, setStable] = useState(true);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const check = closureCheck(task);
  const streak = stableStreak(task);

  function submitConfirm() {
    const result = addConfirmation(getStore().getState(), {
      horseId: archive.horseId,
      hoof: archive.hoof,
      taskId: task.id,
      farrier,
      stable,
      note,
    });
    if (result.errors.length > 0) {
      setError(result.errors.join("；"));
      return;
    }
    apply(result);
    setError(null);
    setFarrier("");
    setNote("");
    setStable(true);
  }

  function submitClose() {
    const result = closeTask(getStore().getState(), archive.horseId, archive.hoof, task.id);
    if (result.errors.length > 0) setError(result.errors.join("；"));
    else {
      apply(result);
      setError(null);
    }
  }

  return (
    <div className="sub-panel recheck-panel">
      <h3>复查准入闭环</h3>

      <Banner kind="error">
        转复查原因：{task.riskFlags.map((r) => RISK_LABEL[r]).join("、")}。闭环条件：
        <ol className="rule-list">
          <li className={streak >= 2 && check.farrier ? "rule-done" : ""}>
            由<b>另一位蹄铁师</b>（非 {task.farrier}）<b>连续两次</b>确认稳定
            {check.farrier ? `（${check.farrier} 已连续 ${streak} 次）` : `（当前连续 ${streak} 次）`}
          </li>
          <li className={check.hasSolePhoto ? "rule-done" : ""}>
            补齐蹄底照片{check.hasSolePhoto ? "（已上传）" : ""}
          </li>
        </ol>
      </Banner>

      {task.confirmations.length > 0 && (
        <ul className="confirm-list">
          {task.confirmations.map((c) => (
            <li key={c.id} className={c.stable ? "confirm-stable" : "confirm-unstable"}>
              <span className={`confirm-dot ${c.stable ? "" : "dot-unstable"}`} />
              <div>
                <strong>
                  {c.farrier} · {c.stable ? "确认稳定" : "认为不稳定（计数清零）"}
                </strong>
                <small>
                  {formatDateTime(c.at)}
                  {c.farrier === task.farrier ? " · 与开工蹄铁师同名（不可计入）" : ""}
                  {c.note ? ` · ${c.note}` : ""}
                </small>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="confirm-form">
        <label>
          <FieldLabel required>复查蹄铁师（须与开工者不同）</FieldLabel>
          <input value={farrier} placeholder="另一位蹄铁师姓名" onChange={(e) => setFarrier(e.target.value)} />
        </label>
        <div className="stable-switch">
          <button
            type="button"
            className={stable ? "chip-active" : ""}
            onClick={() => setStable(true)}
          >
            确认稳定
          </button>
          <button
            type="button"
            className={!stable ? "chip-danger chip-active" : "chip-danger"}
            onClick={() => setStable(false)}
          >
            不稳定（清零重来）
          </button>
        </div>
        <label>
          <FieldLabel>复查备注</FieldLabel>
          <input value={note} placeholder="运步、压诊、裂纹变化等" onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <Banner kind="error">{error}</Banner>}
        <button onClick={submitConfirm}>登记本次复查</button>
      </div>

      <button className="primary close-btn" disabled={!check.canClose} onClick={submitClose}>
        {check.canClose ? "满足条件，执行闭环" : `未达闭环条件（${check.reasons.length} 项）`}
      </button>
    </div>
  );
}
