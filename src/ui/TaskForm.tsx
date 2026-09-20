import { useState } from "react";
import { RISK_LABEL, RISK_OPTIONS } from "../rules/constants";
import { missingRequiredFields, saveTask } from "../rules/engine";
import { addDays, todayString } from "../rules/selectors";
import type { HoofArchive, RiskFlag, ShoeingTask } from "../rules/types";
import { apply } from "./actions";
import { getStore } from "./useArchiveStore";
import { Banner, FieldLabel } from "./components";

export function TaskForm({ archive, task }: { archive: HoofArchive; task: ShoeingTask }) {
  const [farrier, setFarrier] = useState(task.farrier);
  const [gaitIssue, setGaitIssue] = useState(task.gaitIssue ?? "");
  const [hoofShape, setHoofShape] = useState(task.hoofShape ?? "");
  const [shoeType, setShoeType] = useState(task.shoeType ?? "");
  const [nailPositions, setNailPositions] = useState(task.nailPositions ?? "");
  const [recheckDate, setRecheckDate] = useState(task.recheckDate ?? addDays(todayString(), 14));
  const [risks, setRisks] = useState<RiskFlag[]>(task.riskFlags);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const missing = missingRequiredFields({
    gaitIssue,
    hoofShape,
    nailPositions,
    recheckDate,
  });

  function toggleRisk(flag: RiskFlag) {
    setRisks((prev) => (prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag]));
  }

  function submit() {
    // 规则模块判定（缺项直接拒绝）→ 通过后由存储模块统一写入
    const result = saveTask(getStore().getState(), {
      horseId: archive.horseId,
      hoof: archive.hoof,
      taskId: task.id,
      farrier,
      gaitIssue,
      hoofShape,
      shoeType,
      nailPositions,
      recheckDate,
      riskFlags: risks,
      note,
    });
    if (result.errors.length > 0) {
      setError(result.errors.join("；"));
      return;
    }
    apply(result);
    setError(null);
  }

  return (
    <div className="sub-panel">
      <h3>结束修蹄 · 保存记录</h3>
      <div className="field-grid">
        <label>
          <FieldLabel>蹄铁师</FieldLabel>
          <input value={farrier} onChange={(e) => setFarrier(e.target.value)} />
        </label>
        <label>
          <FieldLabel>蹄铁类型</FieldLabel>
          <input
            value={shoeType}
            placeholder="如 铝蹄铁 / 加护蹄垫"
            onChange={(e) => setShoeType(e.target.value)}
          />
        </label>
        <label className="span-2">
          <FieldLabel required>步态问题</FieldLabel>
          <input
            value={gaitIssue}
            placeholder="如 右前蹄外侧磨耗、转弯不稳"
            onChange={(e) => setGaitIssue(e.target.value)}
          />
        </label>
        <label className="span-2">
          <FieldLabel required>蹄形评估</FieldLabel>
          <input
            value={hoofShape}
            placeholder="蹄壁角度、蹄底、蹄叉情况"
            onChange={(e) => setHoofShape(e.target.value)}
          />
        </label>
        <label>
          <FieldLabel required>钉位</FieldLabel>
          <input
            value={nailPositions}
            placeholder="如 内 3 外 4"
            onChange={(e) => setNailPositions(e.target.value)}
          />
        </label>
        <label>
          <FieldLabel required>下次复查日</FieldLabel>
          <input type="date" value={recheckDate} onChange={(e) => setRecheckDate(e.target.value)} />
        </label>
      </div>

      <div className="risk-row">
        <FieldLabel>异常标记（勾选任一即转复查准入）</FieldLabel>
        <div className="chips">
          {RISK_OPTIONS.map((r) => (
            <button
              type="button"
              key={r.value}
              className={risks.includes(r.value) ? "chip-danger chip-active" : "chip-danger"}
              onClick={() => toggleRisk(r.value)}
            >
              {risks.includes(r.value) ? "✓ " : ""}
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <label className="note-field">
        <FieldLabel>照片 / 现场备注</FieldLabel>
        <input
          value={note}
          placeholder="保存时附加备注（照片请在保存后上传）"
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      {missing.length > 0 && (
        <Banner kind="info">必填项待补齐：{missing.join("、")}，未补齐不得保存。</Banner>
      )}
      {risks.length > 0 && (
        <Banner kind="error">
          检测到异常（{risks.map((r) => RISK_LABEL[r]).join("、")}），保存后转复查准入：须由{" "}
          <b>另一位蹄铁师连续两次确认稳定</b> 并补齐蹄底照片才能闭环。
        </Banner>
      )}
      {error && <Banner kind="error">{error}</Banner>}

      <button className="primary" disabled={missing.length > 0} onClick={submit}>
        {risks.length > 0 ? "保存并转复查" : "保存并闭环"}
      </button>
    </div>
  );
}
