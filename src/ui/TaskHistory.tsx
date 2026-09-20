import { HOOF_LABEL, RISK_LABEL, STATUS_LABEL } from "../rules/constants";
import { formatDateTime } from "./format";
import type { HoofArchive, ShoeingTask } from "../rules/types";
import { StatusBadge } from "./components";

const EVENT_LABEL: Record<string, string> = {
  start: "开工",
  save: "保存",
  recheck: "转复查",
  confirm: "复查确认",
  photo: "照片",
  supersede: "换蹄铁失效",
  close: "闭环",
};

export function TaskHistory({ archive }: { archive: HoofArchive }) {
  const tasks = [...archive.tasks].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  return (
    <div className="sub-panel">
      <h3>蹄铁更换历史（含失效结论，全部留档）</h3>
      <div className="history">
        {tasks.map((task, idx) => (
          <article key={task.id} className={`history-task history-${task.status}`}>
            <header>
              <span className="history-index">第 {tasks.length - idx} 次</span>
              <StatusBadge status={task.status} />
              <small>{formatDateTime(task.startedAt)}</small>
            </header>
            <div className="history-fields">
              <span>蹄铁师：{task.farrier}</span>
              <span>蹄铁：{task.shoeType || "—"}</span>
              <span>钉位：{task.nailPositions || "—"}</span>
              <span>复查日：{task.recheckDate || "—"}</span>
              <span>步态：{task.gaitIssue || "—"}</span>
              <span>蹄形：{task.hoofShape || "—"}</span>
              {task.riskFlags.length > 0 && (
                <span className="text-danger">风险：{task.riskFlags.map((r) => RISK_LABEL[r]).join("、")}</span>
              )}
            </div>
            {task.status === "superseded" && (
              <p className="supersede-note">
                该结论已于 {task.supersededAt ? formatDateTime(task.supersededAt) : "—"} 因闭环前换蹄铁失效，记录保留备查（当前状态：
                {STATUS_LABEL[task.status]}）。
              </p>
            )}
            <ul className="event-list">
              {task.events.map((e) => (
                <li key={e.id}>
                  <time>{formatDateTime(e.at)}</time>
                  <span className={`event-tag event-${e.type}`}>{EVENT_LABEL[e.type] ?? e.type}</span>
                  <span>{e.text}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}

/** 同一匹马左前/右前/左后/右后四蹄对比 */
export function HoofCompareStrip({
  archives,
  current,
  onSelect,
}: {
  archives: HoofArchive[];
  current: HoofArchive;
  onSelect: (key: string) => void;
}) {
  const sameHorse = archives.filter((a) => a.horseId === current.horseId);
  const byHoof = new Map(sameHorse.map((a) => [a.hoof, a]));
  const order: ShoeingTask["hoof"][] = ["LF", "RF", "LH", "RH"];

  return (
    <div className="compare-strip">
      <span className="compare-title">同马四蹄对比：</span>
      {order.map((h) => {
        const a = byHoof.get(h);
        const active = a?.tasks.find((t) => t.status === "open" || t.status === "recheck");
        return (
          <button
            key={h}
            type="button"
            className={`compare-cell ${a ? `compare-${active?.status ?? "closed"}` : "compare-empty"} ${
              a?.key === current.key ? "is-selected" : ""
            }`}
            disabled={!a}
            onClick={() => a && onSelect(a.key)}
            title={a ? `${a.horseId} ${HOOF_LABEL[h]}` : "暂无档案"}
          >
            <strong>{HOOF_LABEL[h]}</strong>
            <small>{a ? (active ? STATUS_LABEL[active.status] : "已完结") : "无档案"}</small>
          </button>
        );
      })}
    </div>
  );
}
