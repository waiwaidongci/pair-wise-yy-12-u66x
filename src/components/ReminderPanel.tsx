import {
  REMINDER_LABEL,
  Reminder,
  STATUS_LABEL,
  TrimmingTask,
  HOOF_LABEL,
} from "../business/rules";
import { useReminders } from "../business/ui/useTasks";

interface Props {
  tasks: TrimmingTask[];
  today: string;
  onSelect: (id: string) => void;
}

export default function ReminderPanel({ tasks, today, onSelect }: Props) {
  const reminders = useReminders(today);
  const counts = tasks.reduce(
    (acc, t) => {
      if (t.status === "in_review") acc.review += 1;
      if (t.status === "in_progress") acc.progress += 1;
      return acc;
    },
    { review: 0, progress: 0 },
  );

  return (
    <section className="panel reminder-panel">
      <div className="heading">
        <div>
          <p>复查提醒</p>
          <h2>准入看板</h2>
        </div>
        <span className="pill">
          {counts.progress} 未结束 · {counts.review} 待复查
        </span>
      </div>

      {reminders.length === 0 ? (
        <p className="empty">暂无到期或临近的复查，所有蹄位状态稳定。</p>
      ) : (
        <ul className="reminders">
          {reminders.map((r: Reminder) => (
            <li key={r.taskId + r.level} className={`reminder ${r.level}`}>
              <button type="button" onClick={() => onSelect(r.taskId)}>
                <div className="reminder-head">
                  <b>
                    {r.horseNo} · {HOOF_LABEL[r.hoof]}
                  </b>
                  <span className={`tag ${r.level}`}>{REMINDER_LABEL[r.level]}</span>
                </div>
                <p>
                  复查日 {r.reviewDate}
                  {r.days < 0
                    ? `（已逾期 ${-r.days} 天）`
                    : r.days === 0
                      ? "（今天）"
                      : `（${r.days} 天后）`}
                </p>
                <p className="reason">{r.reason}</p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="hint">
        状态图例：
        {(["in_progress", "in_review", "closed", "void"] as const).map((s) => (
          <span key={s} className={`status-tag st-${s}`}>
            {STATUS_LABEL[s]}
          </span>
        ))}
      </p>
    </section>
  );
}
