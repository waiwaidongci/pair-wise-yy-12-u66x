import { strict as assert } from "node:assert";
import { startWork, saveTask, addConfirmation, addPhoto, closeTask, closureCheck, stableStreak, activeTask } from "../src/rules/engine";
import { selectReminders, selectMetrics, addDays, todayString } from "../src/rules/selectors";
import type { ArchiveState } from "../src/rules/types";

let s: ArchiveState = { version: 1, archives: [] };
let pass = 0;
function check(name: string, cond: boolean) {
  assert.ok(cond, name);
  pass++;
}

// 1. 首次开工
let r = startWork(s, { horseId: "horse-18", hoof: "LF", farrier: "陈" });
check("1 首次开工成功", r.errors.length === 0);
s = r.state;
const key = r.archiveKey;
check("1b 编号归一化大写", key === "HORSE-18|LF");
const taskId = r.taskId!;

// 2. 未结束重复开工 -> 沿用
r = startWork(s, { horseId: "HORSE-18", hoof: "LF", farrier: "王" });
check("2 重复开工沿用", r.reused === true && r.taskId === taskId);
s = r.state;
check("2b 档案仍只有一个任务", s.archives[0].tasks.length === 1);

// 3. 缺项不得保存
r = saveTask(s, {
  horseId: "HORSE-18", hoof: "LF", taskId, farrier: "陈",
  gaitIssue: "", hoofShape: "", shoeType: "铝", nailPositions: "", recheckDate: "",
  riskFlags: [],
});
check("3 缺项拒绝保存", r.errors.length > 0);

// 4. 正常保存（无风险）直接闭环
r = saveTask(s, {
  horseId: "HORSE-18", hoof: "LF", taskId, farrier: "陈",
  gaitIssue: "无", hoofShape: "正常", shoeType: "铝", nailPositions: "内3外4",
  recheckDate: addDays(todayString(), 14), riskFlags: [],
});
check("4 无风险保存即闭环", r.errors.length === 0);
s = r.state;
check("4b 状态 closed", s.archives[0].tasks[0].status === "closed");

// 5. 已闭环任务再开工 -> 新任务（非沿用）
r = startWork(s, { horseId: "HORSE-18", hoof: "LF", farrier: "陈" });
check("5 闭环后开工为新任务", !r.reused && r.taskId !== taskId);
s = r.state;
const task2 = r.taskId!;
check("5b 同档案两个任务", s.archives[0].tasks.length === 2);

// 6. 带风险保存 -> recheck
r = saveTask(s, {
  horseId: "HORSE-18", hoof: "LF", taskId: task2, farrier: "陈",
  gaitIssue: "跛", hoofShape: "裂", shoeType: "垫", nailPositions: "内外4",
  recheckDate: addDays(todayString(), -1), riskFlags: ["crack"],
});
check("6 风险保存转复查", r.errors.length === 0);
s = r.state;
let t2 = s.archives[0].tasks.find((t) => t.id === task2)!;
check("6b 状态 recheck", t2.status === "recheck");

// 7. 准入条件初始不满足
let cc = closureCheck(t2);
check("7 初始不可闭环", !cc.canClose && cc.reasons.length >= 2);

// 8. 同一蹄铁师确认 -> 拒绝
r = addConfirmation(s, { horseId: "HORSE-18", hoof: "LF", taskId: task2, farrier: "陈", stable: true });
check("8 开工者本人复查被拒", r.errors.length > 0);

// 9. 另一位第一次确认稳定 -> 仍不可闭环
r = addConfirmation(s, { horseId: "HORSE-18", hoof: "LF", taskId: task2, farrier: "周", stable: true });
check("9 第一次他人确认成功", r.errors.length === 0);
s = r.state;
t2 = s.archives[0].tasks.find((t) => t.id === task2)!;
check("9b 连续 1 次", stableStreak(t2) === 1 && !closureCheck(t2).canClose);

// 10. 第二次不同蹄铁师 -> recheckFarrier 返回 undefined（必须同一人连续两次）
r = addConfirmation(s, { horseId: "HORSE-18", hoof: "LF", taskId: task2, farrier: "李", stable: true });
s = r.state;
t2 = s.archives[0].tasks.find((t) => t.id === task2)!;
check("10 不同人两次不算同一复查人", closureCheck(t2).farrier === undefined);

// 11. 不稳定清零，随后周连续两次 + 蹄底照片 -> 可闭环
r = addConfirmation(s, { horseId: "HORSE-18", hoof: "LF", taskId: task2, farrier: "周", stable: false });
s = r.state;
t2 = s.archives[0].tasks.find((t) => t.id === task2)!;
check("11 不稳定清零", stableStreak(t2) === 0);

r = addConfirmation(s, { horseId: "HORSE-18", hoof: "LF", taskId: task2, farrier: "周", stable: true });
s = r.state;
r = addConfirmation(s, { horseId: "HORSE-18", hoof: "LF", taskId: task2, farrier: "周", stable: true });
s = r.state;
t2 = s.archives[0].tasks.find((t) => t.id === task2)!;
check("11b 周连续两次稳定", stableStreak(t2) === 2);
check("11c 但无蹄底照片仍不可闭环", !closureCheck(t2).canClose);

r = addPhoto(s, { horseId: "HORSE-18", hoof: "LF", taskId: task2, name: "sole.jpg", kind: "sole", dataUrl: "data:image/jpeg;base64,xxx" });
s = r.state;
t2 = s.archives[0].tasks.find((t) => t.id === task2)!;
check("11d 补齐蹄底照片后可闭环", closureCheck(t2).canClose);

r = closeTask(s, "HORSE-18", "LF", task2);
check("12 闭环成功", r.errors.length === 0);
s = r.state;
check("12b 状态 closed", s.archives[0].tasks.find((t) => t.id === task2)!.status === "closed");

// 13. 闭环前换蹄铁：旧 recheck 失效、历史留档
r = startWork(s, { horseId: "HORSE-18", hoof: "RF", farrier: "陈" });
s = r.state;
const rfId = r.taskId!;
r = saveTask(s, {
  horseId: "HORSE-18", hoof: "RF", taskId: rfId, farrier: "陈",
  gaitIssue: "g", hoofShape: "h", shoeType: "钢", nailPositions: "n",
  recheckDate: addDays(todayString(), 5), riskFlags: ["bruise"],
});
s = r.state;
// 复查中再次开工（换蹄铁）
r = startWork(s, { horseId: "HORSE-18", hoof: "RF", farrier: "李" });
check("13 复查中换蹄铁新开工", r.errors.length === 0 && r.superseded === true && !r.reused);
s = r.state;
const rfArchive = s.archives.find((a) => a.key === "HORSE-18|RF")!;
const oldTask = rfArchive.tasks.find((t) => t.id === rfId)!;
check("13b 旧任务失效", oldTask.status === "superseded" && !!oldTask.supersededAt);
const rfNewId = r.taskId!;
check("13c 新任务修蹄中", activeTask(rfArchive)?.id === rfNewId);
check("13d 历史仍留档（RF 两个任务）", rfArchive.tasks.length === 2);

// 新任务结束修蹄：挫伤转复查，复查日 2 天后
r = saveTask(s, {
  horseId: "HORSE-18", hoof: "RF", taskId: rfNewId, farrier: "李",
  gaitIssue: "g2", hoofShape: "h2", shoeType: "垫", nailPositions: "n2",
  recheckDate: addDays(todayString(), 2), riskFlags: ["bruise"],
});
s = r.state;

// 14. 提醒派生：准入未闭环 + 临近
const reminders = selectReminders(s);
check("14 存在提醒", reminders.length > 0);
check("14b RF 新复查任务 2 天后 -> dueSoon", reminders.some((x) => x.key === "HORSE-18|RF" && x.kind === "dueSoon"));
check("14c RF 复查准入未闭环 -> admission", reminders.some((x) => x.key === "HORSE-18|RF" && x.kind === "admission"));

// 14d LF 旧复查任务闭环后不再产生逾期提醒
check("14d 已闭环任务无提醒", !reminders.some((x) => x.key === "HORSE-18|LF"));

// 15. 指标
const m = selectMetrics(s);
check("15 马匹数=1", m.horses === 1);
check("15b 闭环前换蹄铁计数=1", m.replaced === 1);

console.log(`\n全部 ${pass} 项规则断言通过 ✅`);
