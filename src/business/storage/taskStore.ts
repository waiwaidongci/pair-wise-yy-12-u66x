/**
 * 存储模块：档案持久化与跨标签页同步。
 * 规则全部来自 business/rules，本模块只负责存取、seed 与订阅。
 */
import {
  RecordDraft,
  TrimmingTask,
  applyClose,
  applyConfirmation,
  applyPhoto,
  applyReshoe,
  applySave,
  canClose,
  newId,
  offsetISO,
  startOrReuse,
  todayISO,
} from "../rules";

const STORAGE_KEY = "hxyfront-62011:hoof-archive:v2";
const SEED_FLAG = "hxyfront-62011:seeded:v2";

type Listener = (tasks: TrimmingTask[]) => void;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** 首次使用时写入演示数据，覆盖原静态 records 的三个场景 */
function seedTasks(): TrimmingTask[] {
  const today = todayISO();
  const store: TrimmingTask[] = [];

  // 1) HORSE-18 右前蹄：已正常闭环
  const r1 = startOrReuse(store, {
    horseNo: "HORSE-18",
    hoof: "RF",
    horseCategory: "sport",
    farrier: "赵铁生",
    startedAt: offsetISO(-20),
  });
  const t1 = applySave(
    r1.task,
    {
      horseCategory: "sport",
      farrier: "赵铁生",
      shoeType: "铝蹄铁",
      gaitIssue: "右前蹄外侧磨耗，运步轻微偏外",
      abnormalGait: false,
      hoofAssessment: "蹄壁外展，蹄底角度略平，已修整负重面",
      nailPositions: "内侧 3 钉 / 外侧 4 钉，避开发白线",
      riskFlags: [],
      nextReviewDate: offsetISO(-6),
    },
    offsetISO(-20),
  );
  store.push(t1);

  // 2) HORSE-27 左后蹄：蹄裂转复查，已完成一次稳定确认、已传蹄底照片，差第二次确认
  const r2 = startOrReuse(store, {
    horseNo: "HORSE-27",
    hoof: "LH",
    horseCategory: "rest",
    farrier: "赵铁生",
    startedAt: offsetISO(-10),
  });
  let t2 = applySave(
    r2.task,
    {
      horseCategory: "rest",
      farrier: "赵铁生",
      shoeType: "加护蹄垫",
      gaitIssue: "后蹄着地谨慎，裂纹处偶有闪躲",
      abnormalGait: true,
      hoofAssessment: "左后蹄外侧壁纵裂约 2cm，未及蹄真皮，已加装护垫",
      nailPositions: "内侧 3 钉 / 外侧 3 钉，裂纹两侧各让 1 钉位",
      riskFlags: ["crack"],
      nextReviewDate: offsetISO(4),
    },
    offsetISO(-10),
  );
  t2 = applyPhoto(t2, {
    id: newId("P"),
    name: "HORSE-27-左后蹄-蹄底-20260910.jpg",
    dataUrl: "",
    uploadedAt: offsetISO(-3),
  });
  t2 = applyConfirmation(t2, {
    farrier: "钱守钉",
    stable: true,
    note: "裂纹干燥无延伸，步态改善",
    at: offsetISO(-3),
  });
  store.push(t2);

  // 3) HORSE-31 右前蹄：明显跛行待复查，两次确认未齐、照片缺
  const r3 = startOrReuse(store, {
    horseNo: "HORSE-31",
    hoof: "RF",
    horseCategory: "sport",
    farrier: "孙钉掌",
    startedAt: offsetISO(-5),
  });
  const t3 = applySave(
    r3.task,
    {
      horseCategory: "sport",
      farrier: "孙钉掌",
      shoeType: "普通钢蹄铁",
      gaitIssue: "直线慢步时点头明显，右转抗拒，步态轻微不稳",
      abnormalGait: true,
      hoofAssessment: "蹄底挫伤点一处，蹄叉轻度萎缩，暂不扩创",
      nailPositions: "内侧 4 钉 / 外侧 3 钉，挫伤区域禁钉",
      riskFlags: ["bruise", "lame"],
      nextReviewDate: today,
    },
    offsetISO(-5),
  );
  store.push(t3);

  // 4) HORSE-09 左前蹄：闭环前换蹄铁，旧档案失效留档 + 新档案进行中
  const r4 = startOrReuse(store, {
    horseNo: "HORSE-09",
    hoof: "LF",
    horseCategory: "sport",
    farrier: "赵铁生",
    startedAt: offsetISO(-30),
  });
  const t4 = applySave(
    r4.task,
    {
      horseCategory: "sport",
      farrier: "赵铁生",
      shoeType: "钢蹄铁",
      gaitIssue: "轻度干涉，偶见刷步",
      abnormalGait: false,
      hoofAssessment: "蹄形基本对称，蹄壁硬度正常",
      nailPositions: "内外各 3 钉",
      riskFlags: [],
      nextReviewDate: offsetISO(-16),
    },
    offsetISO(-30),
  );
  // t4 不先入 store：直接交给 applyReshoe，结果为 [t1,t2,t3, voided, newTask]
  const reshoed = applyReshoe(store, t4, offsetISO(-8), "赵铁生");
  reshoed.tasks.forEach((x) => {
    if (!store.some((s) => s.id === x.id)) store.push(x);
  });

  return store;
}

function read(): TrimmingTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TrimmingTask[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // 存储损坏时退回 seed，不阻塞界面
  }
  const seeded = seedTasks();
  write(seeded);
  return seeded;
}

function write(tasks: TrimmingTask[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  try {
    localStorage.setItem(SEED_FLAG, todayISO());
  } catch {
    // 隐私模式等场景忽略
  }
}

class TaskStore {
  private tasks: TrimmingTask[];
  private snapshot: TrimmingTask[] = [];
  private listeners = new Set<Listener>();

  constructor() {
    this.tasks = typeof localStorage === "undefined" ? [] : read();
    this.snapshot = this.tasks;
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key === STORAGE_KEY && e.newValue) {
          try {
            this.tasks = JSON.parse(e.newValue) as TrimmingTask[];
            this.emit();
          } catch {
            // 忽略无法解析的跨页消息
          }
        }
      });
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** 供 useSyncExternalStore 订阅：commit 之间引用稳定，刷新后从 localStorage 恢复 */
  getSnapshot(): TrimmingTask[] {
    return this.snapshot;
  }

  getAll(): TrimmingTask[] {
    return clone(this.snapshot);
  }

  private emit() {
    this.snapshot = this.tasks;
    this.listeners.forEach((fn) => fn(this.snapshot));
  }

  private commit(tasks: TrimmingTask[]) {
    this.tasks = tasks;
    write(tasks);
    this.emit();
  }

  /** 开工或沿用同一蹄位上未结束的修蹄 */
  startOrReuse(input: {
    horseNo: string;
    hoof: TrimmingTask["hoof"];
    horseCategory: TrimmingTask["horseCategory"];
    farrier: string;
    startedAt: string;
  }): { task: TrimmingTask; reused: boolean } {
    const result = startOrReuse(this.tasks, input);
    this.commit(result.tasks);
    return { task: result.task, reused: result.reused };
  }

  /** 保存记录（四项必填已在界面/规则层校验） */
  save(taskId: string, draft: RecordDraft, at: string = todayISO()): TrimmingTask {
    const index = this.tasks.findIndex((t) => t.id === taskId);
    if (index < 0) throw new Error("任务不存在");
    // 重新从最新状态 apply，避免界面持有的 task 过期
    const next = applySave(this.tasks[index], draft, at);
    const tasks = [...this.tasks];
    tasks[index] = next;
    this.commit(tasks);
    return next;
  }

  confirm(
    taskId: string,
    input: { farrier: string; stable: boolean; note?: string; at: string },
  ): TrimmingTask {
    const index = this.tasks.findIndex((t) => t.id === taskId);
    const next = applyConfirmation(this.tasks[index], input);
    const tasks = [...this.tasks];
    tasks[index] = next;
    this.commit(tasks);
    return next;
  }

  addPhoto(taskId: string, photo: Parameters<typeof applyPhoto>[1]): TrimmingTask {
    const index = this.tasks.findIndex((t) => t.id === taskId);
    const next = applyPhoto(this.tasks[index], photo);
    const tasks = [...this.tasks];
    tasks[index] = next;
    this.commit(tasks);
    return next;
  }

  /** 复查闭环；准入不满足时抛错 */
  close(taskId: string, farrier: string, at: string = todayISO()): TrimmingTask {
    const index = this.tasks.findIndex((t) => t.id === taskId);
    const task = this.tasks[index];
    if (!canClose(task)) throw new Error("闭环准入条件未满足");
    const next = applyClose(task, at, farrier);
    const tasks = [...this.tasks];
    tasks[index] = next;
    this.commit(tasks);
    return next;
  }

  /** 闭环前换蹄铁：旧结论失效但留档，返回新任务 */
  reshoe(taskId: string, at: string = todayISO(), farrier?: string): TrimmingTask {
    const old = this.tasks.find((t) => t.id === taskId);
    if (!old) throw new Error("任务不存在");
    const result = applyReshoe(this.tasks, old, at, farrier ?? old.farrier);
    this.commit(result.tasks);
    return result.newTask;
  }

  resetDemo(): TrimmingTask[] {
    const seeded = seedTasks();
    this.commit(seeded);
    return seeded;
  }
}

export const taskStore = new TaskStore();
