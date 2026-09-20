import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { taskStore } from "../business/storage/taskStore";
import { fileToSolePhoto } from "../business/ui/photo";
import {
  REQUIRED_FIELD_LABEL,
  RequiredDraftField,
  RISK_FLAGS,
  RecordDraft,
  STATUS_LABEL,
  TrimmingTask,
  closureBlockers,
  confirmationFarrierError,
  draftFromTask,
  emptyDraft,
  newId,
  offsetISO,
  validateDraft,
} from "../business/rules";

interface Props {
  task: TrimmingTask;
  allTasks: TrimmingTask[];
  today: string;
  notify: (msg: string, kind?: "info" | "warn") => void;
  onSelect: (id: string) => void;
}

/** 末尾连续稳定确认（同一非开工蹄铁师）的计数 */
function stableStreak(task: TrimmingTask): number {
  const owner = task.farrier.trim();
  const confs = task.confirmations;
  let streak = 0;
  let who: string | null = null;
  for (let i = confs.length - 1; i >= 0; i--) {
    const c = confs[i];
    if (!c.stable) break;
    if (c.farrier.trim() === owner) break;
    if (who === null) who = c.farrier.trim();
    if (c.farrier.trim() !== who) break;
    streak += 1;
  }
  return streak;
}

export default function TaskDetail({ task, allTasks, today, notify, onSelect }: Props) {
  // 表单草稿：每次切换任务时从该任务最新状态重建
  const [draft, setDraft] = useState<RecordDraft>(() =>
    task.status === "in_progress" ? draftFromTask(task) : emptyDraft(),
  );
  const [missing, setMissing] = useState<RequiredDraftField[]>([]);
  const [reviewer, setReviewer] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewerError, setReviewerError] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setDraft(task.status === "in_progress" ? draftFromTask(task) : emptyDraft());
    setMissing([]);
    setReviewer("");
    setReviewNote("");
    setReviewerError("");
  }, [task.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const blockers = useMemo(() => closureBlockers(task), [task]);
  const streak = useMemo(() => stableStreak(task), [task]);
  const predecessor = allTasks.find((t) => t.supersededBy === task.id);
  const successor = task.supersededBy
    ? allTasks.find((t) => t.id === task.supersededBy)
    : undefined;

  function patch<K extends keyof RecordDraft>(key: K, value: RecordDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function toggleRisk(flag: (typeof RISK_FLAGS)[number]["key"]) {
    setDraft((d) => ({
      ...d,
      riskFlags: d.riskFlags.includes(flag)
        ? d.riskFlags.filter((f) => f !== flag)
        : [...d.riskFlags, flag],
    }));
  }

  function save() {
    const miss = validateDraft(draft);
    setMissing(miss);
    if (miss.length > 0) {
      notify(`缺少必填项：${miss.map((m) => REQUIRED_FIELD_LABEL[m]).join("、")}，不得保存`, "warn");
      return;
    }
    const next = taskStore.save(task.id, draft);
    if (next.status === "in_review") {
      const names = next.riskFlags
        .map((r) => RISK_FLAGS.find((f) => f.key === r)?.label)
        .filter(Boolean)
        .join("、");
      notify(
        `命中${names}，已转复查：须另一位蹄铁师连续两次确认稳定并补齐蹄底照片`,
        "warn",
      );
    } else {
      notify("四项记录齐全，修蹄档案已闭环归档");
    }
  }

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const photo = await fileToSolePhoto(file);
        taskStore.addPhoto(task.id, { id: newId("P"), ...photo });
      }
      notify(`已上传蹄底照片 ${files.length} 张，刷新后仍可查看`);
    } catch {
      notify("照片处理失败，请更换图片", "warn");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function addConfirmation(stable: boolean) {
    const err = confirmationFarrierError(task, reviewer);
    setReviewerError(err ?? "");
    if (err) {
      notify(err, "warn");
      return;
    }
    taskStore.confirm(task.id, {
      farrier: reviewer,
      stable,
      note: reviewNote,
      at: new Date().toISOString(),
    });
    setReviewNote("");
    notify(stable ? `已记录第 ${streak + 1} 次稳定确认` : "已记录“不稳定”，连续稳定计数重置", stable ? "info" : "warn");
  }

  function close() {
    if (blockers.length > 0) {
      notify(blockers[0], "warn");
      return;
    }
    taskStore.close(task.id, reviewer.trim() || task.confirmations.slice(-1)[0].farrier);
    notify("两次稳定确认 + 蹄底照片齐备，蹄位档案已闭环");
  }

  function reshoe() {
    const label = task.status === "in_review" ? "当前处于复查准入中" : "复查日已到";
    if (!window.confirm(`${label}：闭环前更换蹄铁将使旧结论失效（历史留档），并开立接替任务。是否继续？`)) return;
    const next = taskStore.reshoe(task.id);
    notify("旧档案结论已失效并留档，已生成新的蹄铁更换任务", "warn");
    onSelect(next.id);
  }

  return (
    <section className="panel detail-panel">
      <div className="heading">
        <div>
          <p>
            {task.horseNo} · {HOOF_LABEL_TEXT[task.hoof]} · {task.id}
          </p>
          <h2>
            蹄位档案
            <span className={`status-tag st-${task.status}`}>{STATUS_LABEL[task.status]}</span>
          </h2>
        </div>
        <div className="head-actions">
          {task.status !== "void" && (
            <button type="button" onClick={reshoe} className="ghost danger">
              {task.status === "in_review" ? "闭环前换蹄铁" : "到期 · 更换蹄铁"}
            </button>
          )}
        </div>
      </div>

      {predecessor && (
        <p className="chain-note">
          承接自换蹄铁前的
          <button onClick={() => onSelect(predecessor.id)}>旧档案 {predecessor.id}</button>
          （{predecessor.startedAt}，历史留档）
        </p>
      )}
      {task.status === "void" && (
        <div className="void-box">
          <b>该档案结论已失效</b>
          <span>
            闭环前更换了蹄铁，原复查结论与确认记录全部作废，但完整历史仍保留在此。
            {successor && (
              <>
                {" "}接替任务：
                <button onClick={() => onSelect(successor.id)}>{successor.id}</button>
              </>
            )}
          </span>
        </div>
      )}

      <dl className="meta-grid">
        <div>
          <dt>开工蹄铁师</dt>
          <dd>{task.farrier}</dd>
        </div>
        <div>
          <dt>修蹄日期</dt>
          <dd>{task.startedAt}</dd>
        </div>
        <div>
          <dt>复查日</dt>
          <dd>{task.nextReviewDate ?? "—"}</dd>
        </div>
        <div>
          <dt>风险标记</dt>
          <dd>
            {task.riskFlags.length
              ? task.riskFlags.map((r) => RISK_FLAGS.find((f) => f.key === r)?.label).join("、")
              : "无"}
          </dd>
        </div>
      </dl>

      {/* 一、未结束：修蹄记录表（四项必填） */}
      {task.status === "in_progress" && (
        <div className="block">
          <h3>① 修蹄记录</h3>
          <p className="rule-line">
            规则：步态问题、蹄形评估、钉位、复查日缺一项不得保存；勾选蹄裂 / 挫伤 / 明显跛行将转复查准入。
          </p>
          <div className="field-grid">
            <label>
              <span>马匹类型</span>
              <select
                value={draft.horseCategory}
                onChange={(e) => patch("horseCategory", e.target.value as RecordDraft["horseCategory"])}
              >
                <option value="sport">运动马</option>
                <option value="rest">休养马</option>
              </select>
            </label>
            <label>
              <span>蹄铁师</span>
              <input value={draft.farrier} onChange={(e) => patch("farrier", e.target.value)} placeholder="确认人" />
            </label>
            <label>
              <span>蹄铁类型</span>
              <input value={draft.shoeType} onChange={(e) => patch("shoeType", e.target.value)} placeholder="如 铝蹄铁 / 加护蹄垫" />
            </label>
            <label className="checkbox-label">
              <span>异常步态标记</span>
              <input
                type="checkbox"
                checked={draft.abnormalGait}
                onChange={(e) => patch("abnormalGait", e.target.checked)}
              />
            </label>

            <label className={"full " + (missing.includes("gaitIssue") ? "invalid" : "")}>
              <span>步态问题 * {missing.includes("gaitIssue") && <em>必填</em>}</span>
              <textarea
                rows={2}
                value={draft.gaitIssue}
                onChange={(e) => patch("gaitIssue", e.target.value)}
                placeholder="直线 / 转弯表现、点头、偏外、磨耗…"
              />
            </label>
            <label className={"full " + (missing.includes("hoofAssessment") ? "invalid" : "")}>
              <span>蹄形评估 * {missing.includes("hoofAssessment") && <em>必填</em>}</span>
              <textarea
                rows={2}
                value={draft.hoofAssessment}
                onChange={(e) => patch("hoofAssessment", e.target.value)}
                placeholder="蹄壁、蹄底角度、蹄叉、白线…"
              />
            </label>
            <label className={missing.includes("nailPositions") ? "invalid" : ""}>
              <span>钉位 * {missing.includes("nailPositions") && <em>必填</em>}</span>
              <input
                value={draft.nailPositions}
                onChange={(e) => patch("nailPositions", e.target.value)}
                placeholder="如 内3 / 外4，避让白线"
              />
            </label>
            <label className={missing.includes("nextReviewDate") ? "invalid" : ""}>
              <span>下次复查日 * {missing.includes("nextReviewDate") && <em>必填</em>}</span>
              <input
                type="date"
                min={today}
                value={draft.nextReviewDate}
                onChange={(e) => patch("nextReviewDate", e.target.value)}
              />
            </label>
          </div>

          <div className="risk-row">
            <span>风险情形（命中即转复查）：</span>
            {RISK_FLAGS.map((f) => (
              <button
                type="button"
                key={f.key}
                className={"risk-chip " + (draft.riskFlags.includes(f.key) ? "active" : "")}
                onClick={() => toggleRisk(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button type="button" className="primary" onClick={save}>
            保存记录
          </button>
        </div>
      )}

      {/* 二、待复查：准入闭环 */}
      {task.status === "in_review" && (
        <div className="block review-gate">
          <h3>② 复查准入闭环</h3>
          <div className="gate-grid">
            <div className="gate-item">
              <h4>蹄底照片（{task.solePhotos.length}）</h4>
              <div className="photos">
                {task.solePhotos.length === 0 && <small>尚未补齐蹄底照片，不能闭环。</small>}
                {task.solePhotos.map((p) =>
                  p.dataUrl ? (
                    <a key={p.id} href={p.dataUrl} target="_blank" rel="noreferrer" title={p.name}>
                      <img src={p.dataUrl} alt={p.name} />
                    </a>
                  ) : (
                    <div key={p.id} className="photo-placeholder" title={p.name}>
                      蹄底照片<br />{p.name}
                    </div>
                  ),
                )}
              </div>
              <label className="upload-btn">
                <input type="file" accept="image/*" multiple onChange={upload} disabled={uploading} hidden />
                {uploading ? "处理中…" : "＋ 上传蹄底照片"}
              </label>
            </div>

            <div className="gate-item">
              <h4>另一位蹄铁师连续两次确认稳定</h4>
              <p className="rule-line">
                当前连续稳定：<b className={streak >= 2 ? "ok" : ""}>{streak}</b> / 2
                （确认人须 ≠ 开工蹄铁师「{task.farrier}」，且两次为同一人；出现一次不稳定即重新计数）
              </p>
              <div className="confirm-form">
                <input
                  value={reviewer}
                  onChange={(e) => setReviewer(e.target.value)}
                  placeholder="复查蹄铁师姓名（另一位）"
                />
                <input
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="复查备注（可选）"
                />
                {reviewerError && <small className="inline-warn">{reviewerError}</small>}
                <div className="confirm-buttons">
                  <button type="button" onClick={() => addConfirmation(true)}>
                    确认稳定
                  </button>
                  <button type="button" className="ghost danger" onClick={() => addConfirmation(false)}>
                    确认不稳定
                  </button>
                </div>
              </div>

              <ul className="confirm-list">
                {task.confirmations.map((c, i) => (
                  <li key={c.id} className={c.stable ? "stable" : "unstable"}>
                    <b>第 {i + 1} 次</b>
                    <span>{c.farrier}</span>
                    <span>{c.stable ? "稳定" : "不稳定"}</span>
                    <time>{new Date(c.at).toLocaleString("zh-CN", { hour12: false })}</time>
                    {c.note && <em>{c.note}</em>}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="close-box">
            <h4>闭环准入清单</h4>
            <ul>
              {closureBlockersFresh(task).map((b) => (
                <li key={b} className="blocked">✗ {b}</li>
              ))}
              {blockers.length === 0 && <li className="passed">✓ 两次稳定确认与蹄底照片均已满足，准予闭环</li>}
            </ul>
            <button type="button" className="primary" disabled={blockers.length > 0} onClick={close}>
              闭环归档
            </button>
          </div>
        </div>
      )}

      {/* 三、已闭环：结论与复查建议 */}
      {task.status === "closed" && (
        <div className="block closed-box">
          <h3>③ 闭环结论</h3>
          <p>{task.conclusion}</p>
          <p className="rule-line">
            下次复查日 {task.nextReviewDate ?? "—"}（
            {task.nextReviewDate && offsetISO(0) <= task.nextReviewDate ? "未到期" : "已到期"}
            ）。到期需要换蹄铁时，旧档案保持留档并由新任务接替。
          </p>
        </div>
      )}

      {/* 四、历史时间线（换蹄铁后仍完整留档） */}
      <div className="block timeline">
        <h3>历史留档 · {task.events.length} 条</h3>
        <ol>
          {task.events.map((ev) => (
            <li key={ev.id} className={`ev ev-${ev.type}`}>
              <time>{new Date(ev.at).toLocaleString("zh-CN", { hour12: false })}</time>
              <span>{ev.by}</span>
              <p>{ev.detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const HOOF_LABEL_TEXT = { LF: "左前蹄", RF: "右前蹄", LH: "左后蹄", RH: "右后蹄" } as const;

/** 供清单实时展示（blockers 已 memo，这里再算一次保持同一来源） */
function closureBlockersFresh(task: TrimmingTask): string[] {
  return closureBlockers(task);
}
