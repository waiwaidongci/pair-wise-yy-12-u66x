import { HOOF_LABEL, RISK_LABEL } from "../rules/constants";
import { activeTask } from "../rules/engine";
import { daysUntil } from "../rules/selectors";
import type { ArchiveState } from "../rules/types";
import { EmptyHint, StatusBadge } from "./components";
import { TaskForm } from "./TaskForm";
import { PhotosPanel } from "./PhotosPanel";
import { RecheckPanel } from "./RecheckPanel";
import { HoofCompareStrip, TaskHistory } from "./TaskHistory";

export function ArchiveDetail({
  state,
  archiveKey,
  onSelect,
}: {
  state: ArchiveState;
  archiveKey?: string;
  onSelect: (key: string) => void;
}) {
  const archive = state.archives.find((a) => a.key === archiveKey);

  if (!archive) {
    return (
      <section className="panel detail-panel">
        <EmptyHint>从左侧蹄位档案列表或复查提醒中选择一个蹄位查看详情。</EmptyHint>
      </section>
    );
  }

  const task = activeTask(archive);
  const overdue = task?.recheckDate ? daysUntil(task.recheckDate) < 0 : false;

  return (
    <section className="panel detail-panel">
      <div className="heading">
        <div className="panel-title">
          <p>蹄位档案</p>
          <h2>
            {archive.horseId} · {HOOF_LABEL[archive.hoof]}
          </h2>
        </div>
        {task ? <StatusBadge status={task.status} /> : <span className="badge badge-closed">档案已完结</span>}
      </div>

      <HoofCompareStrip archives={state.archives} current={archive} onSelect={onSelect} />

      {task && (
        <div className="active-summary">
          <div>
            <small>主修蹄铁师</small>
            <strong>{task.farrier}</strong>
          </div>
          <div>
            <small>蹄铁类型</small>
            <strong>{task.shoeType || "未填写"}</strong>
          </div>
          <div>
            <small>复查日</small>
            <strong className={overdue ? "text-danger" : ""}>
              {task.recheckDate || "未保存"}
              {overdue ? " · 已逾期" : ""}
            </strong>
          </div>
          <div>
            <small>风险标记</small>
            <strong className={task.riskFlags.length > 0 ? "text-danger" : ""}>
              {task.riskFlags.length > 0 ? task.riskFlags.map((r) => RISK_LABEL[r]).join("、") : "无"}
            </strong>
          </div>
        </div>
      )}

      {!task && (
        <div className="sub-panel">
          <h3>当前无在办任务</h3>
          <p className="empty-hint">该蹄位所有修蹄任务均已闭环；如需更换蹄铁，请在左侧「开工 / 换蹄铁」发起新任务。</p>
        </div>
      )}

      {task?.status === "open" && <TaskForm archive={archive} task={task} />}

      {task?.status === "recheck" && (
        <>
          <RecheckPanel archive={archive} task={task} />
          <PhotosPanel archive={archive} task={task} />
        </>
      )}

      <TaskHistory archive={archive} />
    </section>
  );
}
