import { FormEvent, useState } from "react";
import { taskStore } from "../business/storage/taskStore";
import {
  HOOF_POSITIONS,
  HoofCode,
  HorseCategory,
  findOpenTask,
  taskKey,
  todayISO,
} from "../business/rules";
import { useTasks } from "../business/ui/useTasks";

interface Props {
  onStarted: (taskId: string, reused: boolean) => void;
  notify: (msg: string, kind?: "info" | "warn") => void;
}

export default function StartPanel({ onStarted, notify }: Props) {
  const tasks = useTasks();
  const [horseNo, setHorseNo] = useState("");
  const [hoof, setHoof] = useState<HoofCode>("LF");
  const [category, setCategory] = useState<HorseCategory>("sport");
  const [farrier, setFarrier] = useState("");
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState("");

  const openHere = horseNo.trim()
    ? findOpenTask(tasks, horseNo, hoof)
    : undefined;

  function submit(e: FormEvent) {
    e.preventDefault();
    const no = horseNo.trim().toUpperCase();
    const name = farrier.trim();
    if (!no) {
      setError("请填写马匹编号");
      return;
    }
    if (!name) {
      setError("请填写蹄铁师姓名");
      return;
    }
    setError("");
    const { task, reused } = taskStore.startOrReuse({
      horseNo: no,
      hoof,
      horseCategory: category,
      farrier: name,
      startedAt: date,
    });
    if (reused) {
      notify(`${no} · 该蹄位已有未结束修蹄（${task.status === "in_review" ? "待复查" : "未结束"}），已沿用原任务，不重复开工`, "warn");
    } else {
      notify(`已为 ${no} 开立修蹄任务，请补齐四项记录后保存`);
    }
    onStarted(task.id, reused);
  }

  return (
    <section className="panel start-panel">
      <div className="heading">
        <div>
          <p>蹄位更换</p>
          <h2>开工 / 沿用任务</h2>
        </div>
      </div>
      <form onSubmit={submit} className="start-form">
        <label className="full">
          <span>马匹编号（与蹄位共同唯一）</span>
          <input
            value={horseNo}
            placeholder="如 HORSE-18"
            onChange={(e) => setHorseNo(e.target.value)}
          />
        </label>

        <div className="full hoof-picker" role="radiogroup" aria-label="选择蹄位">
          {HOOF_POSITIONS.map((p) => (
            <button
              type="button"
              key={p.code}
              className={hoof === p.code ? "active" : ""}
              onClick={() => setHoof(p.code)}
              title={p.axle === "front" ? "前蹄" : "后蹄"}
            >
              {p.label}
            </button>
          ))}
        </div>

        <label>
          <span>马匹类型</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as HorseCategory)}>
            <option value="sport">运动马</option>
            <option value="rest">休养马</option>
          </select>
        </label>
        <label>
          <span>开工蹄铁师</span>
          <input value={farrier} placeholder="姓名" onChange={(e) => setFarrier(e.target.value)} />
        </label>
        <label className="full">
          <span>修蹄日期</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>

        {openHere && (
          <p className="inline-warn full">
            {taskKey(openHere.horseNo, openHere.hoof)} 已有未结束档案，开工将沿用原任务而不是新建。
          </p>
        )}
        {error && <p className="inline-warn full">{error}</p>}

        <button type="submit" className="primary full">
          {openHere ? "沿用原任务" : "开工"}
        </button>
      </form>
    </section>
  );
}
