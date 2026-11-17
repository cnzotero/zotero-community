#!/usr/bin/env node
// 从本仓库 git 历史里找出「公开发布被大量移除、导致统计塌缩」的插件,给出塌缩前最后一次公开刷新的数据,
// 供 src/data/carryover.json(历史保留)使用。对所有插件同一规则,不按插件开特例:
//   - 累计下载:相邻两次每日刷新之间,现存安装包的下载总数降到上一次的一半或更低(含降到 0);
//   - 近一年发布次数:上一次不少于 10 次,下一次降到一半或更低;
//   - 并且下降要持续:从下降那天起到最近一次,至少连续 3 次刷新都还在一半或以下。只出现一两天又恢复的,
//     多半是接口某天返回的数据不全,不算(历史里确有这种情况)。已按历史保留计算的插件,之后的数据不再参与判断。
// 每项数据都写明出处:取自哪个提交(commit / date)、在哪个提交第一次看到下降(dropCommit / dropDate)。
// 同一天的多个提交只取第一个(即当天每日刷新的那次),cutoff 取该提交的时间,近似数据取得的时间。
// 用法:node --experimental-strip-types scripts/carryover-scan.mjs [--write]
//   默认只打印候选;--write 把文件里还没有的条目或分项补进 src/data/carryover.json(已有的不覆盖),写入前请人工核对。
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PLUGINS_FILE } from "./catalog.ts";
import { CARRYOVER, formatCarryover, readCarryover } from "./refresh-plugins.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// 读的是各历史提交里的插件数据(git show),路径取自唯一的数据入口 catalog.ts
const DATA = relative(root, PLUGINS_FILE);
const HISTORY = DATA.replace(/[^/]+$/, "history.json");

export const MIN_PERSIST = 3;

/** 序列 seq(按时间)里第一次「降到一半或更低、并持续到最后至少 MIN_PERSIST 次」的位置;没有返回 -1。 */
export function persistentDrop(values, minBefore = 1) {
  for (let i = 1; i < values.length; i++) {
    const before = values[i - 1];
    if (!(before >= minBefore) || values.length - i < MIN_PERSIST) continue;
    if (values.slice(i).every((v) => v * 2 <= before)) return i;
  }
  return -1;
}

/**
 * series:按时间排序的每日数据 [{ commit, time, day, plugins: Map<id, { raw?: number, cadence?: object, carried?: boolean }> }],
 * raw 是当天现存安装包的下载总数(没有记录为 undefined)。返回 { id: { dl?, cadence? } }。
 */
export function findCollapses(series) {
  const seqs = new Map();
  for (const s of series) {
    for (const [id, cur] of s.plugins) {
      if (!seqs.has(id)) seqs.set(id, { dl: [], cad: [], stop: false });
      const q = seqs.get(id);
      if (q.stop || cur.carried) { q.stop = true; continue; } // 已按历史保留计算,之后的数不是现存发布的原始数据
      if (cur.raw !== undefined) q.dl.push({ s, v: cur.raw });
      if (cur.cadence) q.cad.push({ s, v: cur.cadence.r12, c: cur.cadence });
    }
  }
  const out = {};
  for (const [id, q] of seqs) {
    const e = {};
    const i = persistentDrop(q.dl.map((x) => x.v));
    if (i > 0) {
      const p = q.dl[i - 1];
      e.dl = { commit: p.s.commit, date: p.s.day, cutoff: p.s.time, dropCommit: q.dl[i].s.commit, dropDate: q.dl[i].s.day, total: p.v };
    }
    const j = persistentDrop(q.cad.map((x) => x.v), 10);
    if (j > 0) {
      const p = q.cad[j - 1];
      const { r12, days12, monthly, medianDays, last, capped } = p.c;
      e.cadence = {
        commit: p.s.commit, date: p.s.day, cutoff: p.s.time, dropCommit: q.cad[j].s.commit, dropDate: q.cad[j].s.day,
        r12, ...(typeof days12 === "number" ? { days12 } : {}), monthly, medianDays, last, ...(capped ? { capped: true } : {}),
      };
    }
    if (e.dl || e.cadence) out[id] = e;
  }
  return out;
}

/** 把候选补进现有的 carryover 数据:已有条目里已有的分项不覆盖。返回新增的「id 分项」清单。 */
export function mergeCandidates(existing, found) {
  const added = [];
  for (const [id, e] of Object.entries(found)) {
    const cur = (existing[id] ??= {});
    for (const k of ["cadence", "dl"]) if (e[k] && !cur[k]) { cur[k] = e[k]; added.push(`${id} ${k}`); }
  }
  return added;
}

function git(...args) {
  return execFileSync("git", ["-C", root, ...args], { maxBuffer: 1 << 30, stdio: ["ignore", "pipe", "ignore"] }).toString();
}

function buildSeries() {
  const lines = git("log", "--reverse", "--format=%H %cI", "--", DATA).trim().split("\n");
  const series = [];
  const seenDays = new Set();
  for (const line of lines) {
    const [commit, time] = line.split(" ");
    let data, history;
    try {
      data = JSON.parse(git("show", `${commit}:${DATA}`));
      history = JSON.parse(git("show", `${commit}:${HISTORY}`));
    } catch {
      continue; // 早期提交还没有历史快照
    }
    const day = data.generatedAt;
    if (seenDays.has(day)) continue;
    seenDays.add(day);
    const plugins = new Map();
    for (const p of data.plugins) {
      const h = (history[p.id] ?? []).find((x) => x[0] === day);
      plugins.set(p.id, { raw: h ? (typeof h[2] === "number" ? h[2] : 0) : undefined, cadence: p.cadence, carried: p.cadence?.carried === true || p.dl?.carried === true });
    }
    series.push({ commit, time: new Date(time).toISOString().replace(".000Z", "Z"), day, plugins });
  }
  return series;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const found = findCollapses(buildSeries());
  if (!process.argv.includes("--write")) {
    console.log(JSON.stringify(found, null, 2));
  } else {
    const file = readCarryover();
    const added = mergeCandidates(file.plugins, found);
    file.plugins = Object.fromEntries(Object.entries(file.plugins).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(CARRYOVER, formatCarryover(file));
    console.log(added.length ? `已补入:\n${added.join("\n")}` : "没有需要补入的条目");
  }
}
