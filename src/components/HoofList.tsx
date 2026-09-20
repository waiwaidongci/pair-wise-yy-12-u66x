import { useMemo, useState } from "react";
import {
  HOOF_LABEL,
  HOOF_POSITIONS,
  STATUS_LABEL,
  TrimmingTask,
  isOpen,
  taskKey,
} from "../business/rules";

export type FilterKey = "all" | "front" | "hind" | "sport" | "rest" | "open";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "front", label: "前蹄" },
  { key: "hind", label: "后蹄" },
  { key: "sport", label: "运动马" },
  { key: "rest", label: "休养马" },
  { key: "open", label: "仅看未结束" },
];

interface HorseGroup {
  horseNo: string;
  category: TrimmingTask["horseCategory"];
  /** 每个蹄位按时间排序的档案，最新在最后 */
  byHoof: Map<string, TrimmingTask[]>;
}

interface Props {
  tasks: TrimmingTask[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function HoofList({ tasks, selectedId, onSelect }: Props) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");

  const groups = useMemo<HorseGroup[]>(() => {
    const map = new Map<string, HorseGroup>();
    for (const t of tasks) {
      let g = map.get(t.horseNo);
      if (!g) {
        g = { horseNo: t.horseNo, category: t.horseCategory, byHoof: new Map() };
        map.set(t.horseNo, g);
      }
      const list = g.byHoof.get(t.hoof) ?? [];
      list.push(t);
      g.byHoof.set(t.hoof, list);
    }
    return [...map.values()]
      .filter((g) => (query.trim() ? g.horseNo.includes(query.trim().toUpperCase()) : true))
      .filter((g) => {
        if (filter === "sport") return g.category === "sport";
        if (filter === "rest") return g.category === "rest";
        if (filter === "open")
          return [...g.byHoof.values()].some((list) => isOpen(list[list.length - 1].status));
        return true;
      })
      .sort((a, b) => a.horseNo.localeCompare(b.horseNo));
  }, [tasks, query, filter]);

  return (
    <section className="panel list-panel">
      <div className="heading">
        <div>
          <p>马匹列表 · 左右前后蹄对比</p>
          <h2>蹄位档案</h2>
        </div>
        <input
          className="search"
          placeholder="搜索马匹编号"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="chips">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={filter === f.key ? "active" : ""}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="horse-list">
        {groups.length === 0 && <p className="empty">没有匹配的马匹档案。</p>}
        {groups.map((g) => (
          <article key={g.horseNo} className="horse-card">
            <header>
              <h3>{g.horseNo}</h3>
              <span className="cat">{g.category === "sport" ? "运动马" : "休养马"}</span>
            </header>
            <div className={`hoof-grid ${filter === "front" || filter === "hind" ? "dim-other" : ""}`}>
              {HOOF_POSITIONS.map((p) => {
                const list = (g.byHoof.get(p.code) ?? []).sort((a, b) =>
                  a.startedAt.localeCompare(b.startedAt),
                );
                const latest = list[list.length - 1];
                const dim =
                  (filter === "front" && p.axle !== "front") ||
                  (filter === "hind" && p.axle !== "hind");
                if (!latest) {
                  return (
                    <div key={p.code} className={`hoof-cell empty-cell ${dim ? "dim" : ""}`}>
                      <span>{HOOF_LABEL[p.code]}</span>
                      <small>无档案</small>
                    </div>
                  );
                }
                return (
                  <div
                    key={p.code}
                    className={`hoof-cell st-${latest.status} ${dim ? "dim" : ""} ${
                      latest.id === selectedId ? "selected" : ""
                    }`}
                  >
                    <button type="button" onClick={() => onSelect(latest.id)}>
                      <span>{HOOF_LABEL[p.code]}</span>
                      <b>{STATUS_LABEL[latest.status]}</b>
                      {latest.abnormalGait && <em className="gait-dot" title="异常步态">！</em>}
                      {list.length > 1 && <small>{list.length} 条历史</small>}
                    </button>
                    {list.length > 1 && (
                      <div className="history-chain">
                        {list.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            title={`${t.startedAt} · ${STATUS_LABEL[t.status]}`}
                            className={`chain-dot st-${t.status} ${t.id === selectedId ? "on" : ""}`}
                            onClick={() => onSelect(t.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
      <p className="hint">每个马匹编号 × 蹄位只允许一条未结束档案；重复开工自动沿用原任务（键：{taskKey("示例", "LF")} 规则）。</p>
    </section>
  );
}
