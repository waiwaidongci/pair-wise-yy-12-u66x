import { selectReminders } from "../rules/selectors";
import type { ArchiveState } from "../rules/types";
import { EmptyHint } from "./components";

const KIND_TEXT = {
  overdue: { label: "已逾期", className: "reminder-overdue" },
  dueSoon: { label: "临近", className: "reminder-soon" },
  admission: { label: "准入未闭环", className: "reminder-admission" },
} as const;

export function RemindersPanel({
  state,
  selectedKey,
  onSelect,
}: {
  state: ArchiveState;
  selectedKey?: string;
  onSelect: (key: string) => void;
}) {
  const reminders = selectReminders(state);
  return (
    <div className="panel side-panel reminders">
      <div className="panel-title">
        <p>复查日 / 准入</p>
        <h2>复查提醒 <span className="count">{reminders.length}</span></h2>
      </div>
      {reminders.length === 0 ? (
        <EmptyHint>暂无待办复查，所有在办蹄位均在复查期内且准入齐备。</EmptyHint>
      ) : (
        <ul className="reminder-list">
          {reminders.map((item) => (
            <li key={`${item.kind}-${item.taskId}`}>
              <button
                type="button"
                className={`reminder-item ${KIND_TEXT[item.kind].className} ${
                  selectedKey === item.key ? "is-selected" : ""
                }`}
                onClick={() => onSelect(item.key)}
              >
                <span className="reminder-tag">{KIND_TEXT[item.kind].label}</span>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
