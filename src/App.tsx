import { useCallback, useEffect, useState } from "react";
import "./styles.css";
import StartPanel from "./components/StartPanel";
import ReminderPanel from "./components/ReminderPanel";
import HoofList from "./components/HoofList";
import TaskDetail from "./components/TaskDetail";
import { taskStore } from "./business/storage/taskStore";
import { useMetrics, useTasks } from "./business/ui/useTasks";
import { todayISO } from "./business/rules";

const METRIC_LABEL = ["待复查", "异常步态", "更换蹄铁", "马匹档案"] as const;

interface Toast {
  id: number;
  msg: string;
  kind: "info" | "warn";
}

function App() {
  const tasks = useTasks();
  const metrics = useMetrics();
  const today = todayISO();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((msg: string, kind: "info" | "warn" = "info") => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { id, msg, kind }]);
    window.setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  // 默认选中第一条待处理档案；若所选档案被换蹄铁接替仍可查看（旧档留档）
  useEffect(() => {
    if (tasks.length === 0) return;
    if (selectedId && tasks.some((t) => t.id === selectedId)) return;
    const priority = tasks.find((t) => t.status === "in_review")
      ?? tasks.find((t) => t.status === "in_progress")
      ?? tasks[0];
    setSelectedId(priority.id);
  }, [tasks, selectedId]);

  const selected = tasks.find((t) => t.id === selectedId);
  const values = [metrics.review, metrics.abnormalGait, metrics.reshoe, metrics.horses];

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62011 · 蹄铁业务系统 · Port 62011</p>
        <h1>蹄位更换与复查准入闭环</h1>
        <span>
          马匹编号 × 蹄位唯一；未结束修蹄重复开工只沿用原任务。步态问题、蹄形评估、钉位、复查日缺一项不得保存；
          蹄裂 / 挫伤 / 明显跛行转复查，须另一位蹄铁师连续两次确认稳定并补齐蹄底照片才闭环；闭环前换蹄铁旧结论失效、历史留档。
        </span>
      </section>

      <section className="metrics">
        {METRIC_LABEL.map((label, i) => (
          <article key={label}>
            <small>{label}</small>
            <strong>{values[i]}</strong>
          </article>
        ))}
      </section>

      <section className="workspace workspace-top">
        <StartPanel
          onStarted={(id) => setSelectedId(id)}
          notify={notify}
        />
        <ReminderPanel tasks={tasks} today={today} onSelect={setSelectedId} />
      </section>

      <section className="workspace workspace-bottom">
        <HoofList tasks={tasks} selectedId={selectedId} onSelect={setSelectedId} />
        {selected ? (
          <TaskDetail
            key={selected.id}
            task={selected}
            allTasks={tasks}
            today={today}
            notify={notify}
            onSelect={setSelectedId}
          />
        ) : (
          <section className="panel detail-panel">
            <p className="empty">请从左侧选择一个蹄位档案。</p>
          </section>
        )}
      </section>

      <footer className="footline">
        <span>数据保存在本机浏览器 localStorage，列表、提醒与详情刷新后保持一致；多标签页实时同步。</span>
        <button
          className="ghost"
          onClick={() => {
            if (window.confirm("恢复为演示数据？当前所有档案将被覆盖。")) {
              const seeded = taskStore.resetDemo();
              setSelectedId(seeded[0]?.id ?? null);
              notify("已恢复演示数据");
            }
          }}
        >
          恢复演示数据
        </button>
      </footer>

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </main>
  );
}

export default App;
