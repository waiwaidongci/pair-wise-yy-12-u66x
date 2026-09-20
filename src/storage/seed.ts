import { STATE_VERSION } from "../rules/constants";
import type {
  ArchiveState,
  HoofArchive,
  HoofCode,
  RiskFlag,
  ShoeingTask,
  TaskEvent,
  TaskStatus,
} from "../rules/types";
import { addDays, todayString } from "../rules/selectors";

let seedSeq = 0;
function sid(prefix: string): string {
  seedSeq += 1;
  return `${prefix}_seed_${seedSeq}`;
}

function at(daysAgo: number, hour = 9): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function ev(type: TaskEvent["type"], text: string, daysAgo = 0): TaskEvent {
  return { id: sid("ev"), at: at(daysAgo), type, text };
}

interface SeedTaskSpec {
  horseId: string;
  farrier: string;
  hoof: HoofCode;
  status: TaskStatus;
  startedDaysAgo: number;
  endedDaysAgo?: number;
  recheckInDays?: number;
  shoeType: string;
  gaitIssue: string;
  hoofShape: string;
  nailPositions: string;
  riskFlags: RiskFlag[];
  confirmations?: { farrier: string; stable: boolean; daysAgo: number; note?: string }[];
  events: TaskEvent[];
  solePhoto?: boolean;
}

function buildTask(spec: SeedTaskSpec): ShoeingTask {
  const status = spec.status;
  return {
    id: sid("task"),
    horseId: spec.horseId,
    hoof: spec.hoof,
    farrier: spec.farrier,
    startedAt: at(spec.startedDaysAgo),
    endedAt: spec.endedDaysAgo !== undefined ? at(spec.endedDaysAgo) : undefined,
    closedAt: status === "closed" && spec.endedDaysAgo !== undefined ? at(spec.endedDaysAgo) : undefined,
    supersededAt: status === "superseded" ? at(spec.startedDaysAgo - 1) : undefined,
    shoeType: spec.shoeType,
    gaitIssue: spec.gaitIssue,
    hoofShape: spec.hoofShape,
    nailPositions: spec.nailPositions,
    recheckDate: spec.recheckInDays !== undefined ? addDays(todayString(), spec.recheckInDays) : undefined,
    riskFlags: spec.riskFlags,
    photos: spec.solePhoto
      ? [
          {
            id: sid("ph"),
            name: "蹄底存档（示例）.jpg",
            kind: "sole",
            dataUrl: "",
            at: at(spec.endedDaysAgo ?? spec.startedDaysAgo),
          },
        ]
      : [],
    confirmations: (spec.confirmations ?? []).map((c) => ({
      id: sid("cf"),
      farrier: c.farrier,
      stable: c.stable,
      at: at(c.daysAgo, 16),
      note: c.note,
    })),
    status,
    events: spec.events,
  };
}

/** 演示数据：覆盖 修蹄中 / 复查逾期 / 两次稳定仅差照片 / 已闭环 / 换蹄铁失效留档 */
export function buildSeedState(): ArchiveState {
  const specs: SeedTaskSpec[] = [
    {
      horseId: "HORSE-18",
      farrier: "陈铁山",
      hoof: "LF",
      status: "open",
      startedDaysAgo: 0,
      shoeType: "铝蹄铁",
      gaitIssue: "",
      hoofShape: "",
      nailPositions: "",
      riskFlags: [],
      events: [ev("start", "陈铁山 开工修蹄（右前蹄外侧磨耗待评估）", 0)],
    },
    {
      horseId: "HORSE-27",
      farrier: "陈铁山",
      hoof: "RH",
      status: "recheck",
      startedDaysAgo: 6,
      endedDaysAgo: 5,
      recheckInDays: -1,
      shoeType: "加护蹄垫",
      gaitIssue: "落地瞬间后躯躲闪",
      hoofShape: "蹄壁外斜、蹄底轻度压扁",
      nailPositions: "内侧 3 钉 / 外侧 4 钉",
      riskFlags: ["crack"],
      confirmations: [{ farrier: "周巧云", stable: true, daysAgo: 2, note: "裂纹未见延伸" }],
      events: [
        ev("start", "陈铁山 开工修蹄", 6),
        ev("recheck", "保存并转复查准入：蹄裂", 5),
        ev("confirm", "周巧云 第 1 次复查：确认稳定（裂纹未见延伸）", 2),
      ],
    },
    {
      horseId: "HORSE-31",
      farrier: "陈铁山",
      hoof: "LH",
      status: "recheck",
      startedDaysAgo: 8,
      endedDaysAgo: 7,
      recheckInDays: 0,
      shoeType: "普通钢蹄铁",
      gaitIssue: "步态轻微不稳，转弯明显",
      hoofShape: "蹄叉偏窄、跟部稍高",
      nailPositions: "内外各 4 钉",
      riskFlags: ["lameness"],
      confirmations: [
        { farrier: "周巧云", stable: true, daysAgo: 3, note: "直线运步改善" },
        { farrier: "周巧云", stable: true, daysAgo: 1, note: "快步稳定，准予闭环复核" },
      ],
      events: [
        ev("start", "陈铁山 开工修蹄", 8),
        ev("recheck", "保存并转复查准入：明显跛行", 7),
        ev("confirm", "周巧云 第 1 次复查：确认稳定（直线运步改善）", 3),
        ev("confirm", "周巧云 第 2 次复查：确认稳定（快步稳定，准予闭环复核）", 1),
      ],
    },
    {
      horseId: "HORSE-09",
      farrier: "李德福",
      hoof: "RF",
      status: "closed",
      startedDaysAgo: 20,
      endedDaysAgo: 20,
      recheckInDays: 14,
      shoeType: "树脂蹄铁",
      gaitIssue: "无明显异常",
      hoofShape: "蹄形对称，角度正常",
      nailPositions: "内外各 3 钉",
      riskFlags: [],
      solePhoto: true,
      events: [
        ev("start", "李德福 开工修蹄", 20),
        ev("save", "修蹄记录保存完成，正常闭环（复查日见档案）", 20),
        ev("close", "无蹄裂/挫伤/明显跛行，直接闭环", 20),
      ],
    },
    {
      horseId: "HORSE-44",
      farrier: "陈铁山",
      hoof: "LH",
      status: "superseded",
      startedDaysAgo: 30,
      recheckInDays: -10,
      shoeType: "普通钢蹄铁",
      gaitIssue: "内侧面磨耗偏重",
      hoofShape: "蹄壁内倾",
      nailPositions: "内 3 外 4",
      riskFlags: ["bruise"],
      events: [
        ev("start", "陈铁山 开工修蹄", 30),
        ev("recheck", "保存并转复查准入：挫伤", 29),
        ev("supersede", "闭环前换蹄铁，复查结论作废（历史保留）；新修蹄由 李德福 开工", 12),
      ],
    },
    {
      horseId: "HORSE-44",
      farrier: "李德福",
      hoof: "LH",
      status: "recheck",
      startedDaysAgo: 12,
      endedDaysAgo: 11,
      recheckInDays: 10,
      shoeType: "加护蹄垫 + 楔形垫",
      gaitIssue: "挫伤复查，运步明显改善",
      hoofShape: "跟部角度已矫正 2°",
      nailPositions: "内外各 4 钉",
      riskFlags: ["bruise"],
      events: [
        ev("start", "李德福 开工修蹄（沿用 HORSE-44 左后蹄档案）", 12),
        ev("recheck", "保存并转复查准入：挫伤", 11),
      ],
    },
  ];

  const archives: HoofArchive[] = [];
  for (const spec of specs) {
    const task = buildTask(spec);
    const key = `${spec.horseId}|${spec.hoof}`;
    let archive = archives.find((a) => a.key === key);
    if (!archive) {
      archive = {
        key,
        horseId: spec.horseId,
        hoof: spec.hoof,
        tasks: [],
        createdAt: task.startedAt,
      };
      archives.push(archive);
    }
    archive.tasks.push(task);
  }

  return { version: STATE_VERSION, archives };
}
