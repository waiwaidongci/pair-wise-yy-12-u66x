import { useMemo, useState } from "react";
import { HOOF_LABEL } from "../rules/constants";
import {
  daysUntil,
  selectArchiveList,
} from "../rules/selectors";
import type { ArchiveState } from "../rules/types";
import { StatusBadge } from "./components";

type Filter = "all" | "front" | "hind" | "active" | "abnormal";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "全部蹄位" },
  { value: "front", label: "前蹄" },
  { value: "hind", label: "后蹄" },
  { value: "active", label: "未闭环" },
  { value: "abnormal", label: "异常风险" },
];

export function ArchiveList({
  state,
  selectedKey,
  onSelect,
}: {
  state: ArchiveState;
  selectedKey?: string;
  onSelect: (key: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    const list = selectArchiveList(state);
    const q = query.trim().toUpperCase();
    return list.filter((item) => {
      if (q && !item.horseId.includes(q)) return false;
      if (filter === "front" && !(item.hoof === "LF" || item.hoof === "RF")) return false;
      if (filter === "hind" && !(item.hoof === "LH" || item.hoof === "RH")) return false;
      if (filter === "active" && (!item.active || item.active.status === "closed")) return false;
      if (filter === "abnormal" && !(item.active && item.active.riskFlags.length > 0)) return false;
      return true;
    });
  }, [state, filter, query]);

  return (
    <section className="panel">
      <div className="heading">
        <div className="panel-title">
          <p>编号 + 蹄位 唯一档案</p>
          <h2>蹄位档案列表</h2>
        </div>
        <input
          className="search"
          value={query}
          placeholder="搜索马匹编号"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="chips">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            className={filter === f.value ? "chip-active" : ""}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="archive-grid">
        {items.length === 0 && <p className="empty-hint">没有符合条件的蹄位档案。</p>}
        {items.map((item) => {
          const overdue = item.active?.recheckDate
            ? daysUntil(item.active.recheckDate) < 0
            : false;
          return (
            <button
              key={item.key}
              type="button"
              className={`archive-card ${selectedKey === item.key ? "is-selected" : ""}`}
              onClick={() => onSelect(item.key)}
            >
              <div className="archive-card-head">
                <strong>
                  {item.horseId} · {HOOF_LABEL[item.hoof]}
                </strong>
                {item.active ? (
                  <StatusBadge status={item.active.status} />
                ) : (
                  <span className="badge badge-closed">已完结档案</span>
                )}
              </div>
              <div className="archive-card-body">
                {item.active ? (
                  <>
                    <span>{item.active.gaitIssue || "步态问题待录入"}</span>
                    <span className={overdue ? "text-danger" : ""}>
                      复查日 {item.active.recheckDate || "未保存"}
                      {overdue ? "（已逾期）" : ""}
                    </span>
                  </>
                ) : (
                  <span>共 {item.taskCount} 次修蹄记录</span>
                )}
              </div>
              <small>历史任务 {item.taskCount} 次 · 全部留档</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
