import { useMemo, useState } from "react";
import "./styles.css";
import { selectMetrics } from "./rules/selectors";
import { useArchiveState, resetDemoData } from "./ui/useArchiveStore";
import { MetricsBar } from "./ui/MetricsBar";
import { StartWorkPanel } from "./ui/StartWorkPanel";
import { RemindersPanel } from "./ui/RemindersPanel";
import { ArchiveList } from "./ui/ArchiveList";
import { ArchiveDetail } from "./ui/ArchiveDetail";

function App() {
  const state = useArchiveState();
  const [selectedKey, setSelectedKey] = useState<string | undefined>(undefined);
  const metrics = useMemo(() => selectMetrics(state), [state]);

  return (
    <main className="app">
      <section className="hero">
        <p>马术俱乐部蹄铁作业系统 · 蹄位更换与复查准入闭环</p>
        <h1>蹄铁修整档案</h1>
        <span>
          马匹编号 + 蹄位唯一建档；未结束修蹄重复开工沿用原任务。步态问题、蹄形评估、钉位、复查日缺一不得保存；
          蹄裂 / 挫伤 / 明显跛行转复查，须另一位蹄铁师连续两次确认稳定并补齐蹄底照片方可闭环；
          闭环前换蹄铁，旧结论失效但历史留档。
        </span>
        <div className="hero-actions">
          <button onClick={() => setSelectedKey(undefined)}>全部档案</button>
          <button
            onClick={() => {
              resetDemoData();
              setSelectedKey(undefined);
            }}
          >
            恢复演示数据
          </button>
        </div>
      </section>

      <MetricsBar metrics={metrics} />

      <ArchiveList state={state} selectedKey={selectedKey} onSelect={setSelectedKey} />

      <section className="workspace">
        <aside className="side-column">
          <StartWorkPanel state={state} onOpened={setSelectedKey} />
          <RemindersPanel state={state} selectedKey={selectedKey} onSelect={setSelectedKey} />
        </aside>
        <ArchiveDetail state={state} archiveKey={selectedKey} onSelect={setSelectedKey} />
      </section>
    </main>
  );
}

export default App;
