import assert from "node:assert/strict";
import test from "node:test";
import { createDownloadReporter, dlBeaconUrl, downloadLinkHandlers, parseDlStats, siteDownloadsOf } from "./site-downloads.ts";

test("上报地址只带插件 id 和版本号", () => {
  assert.equal(dlBeaconUrl("windingwind/zotero-pdf-translate", "2.3.16"), "/api/dl?p=windingwind%2Fzotero-pdf-translate&v=2.3.16");
  assert.equal(dlBeaconUrl("a-b/c.d_e", "5.1.2-beta.1"), "/api/dl?p=a-b%2Fc.d_e&v=5.1.2-beta.1");
  assert.equal(dlBeaconUrl("a/b", "1.0+build.7"), "/api/dl?p=a%2Fb&v=1.0%2Bbuild.7");
});

test("格式不对的 id 或版本号不上报", () => {
  for (const [id, v] of [
    ["A/b", "1.0"], // 本站数据里 id 都是小写
    ["a", "1.0"],
    ["a/b/c", "1.0"],
    ["-a/b", "1.0"],
    ["a/b c", "1.0"],
    ["a/b\"", "1.0"],
    ["a/b", ""],
    ["a/b", ".1"],
    ["a/b", "1.0 x"],
    ["a/b", "1.0\"&x=1"],
    ["a/b", "1".repeat(41)],
    [`${"a".repeat(40)}/b`, "1.0"],
  ]) {
    assert.equal(dlBeaconUrl(id, v), null, `${id} ${v}`);
  }
});

test("同一次点击只上报一次,隔一会儿再点会再记", () => {
  const sent: string[] = [];
  let t = 1000;
  const rep = createDownloadReporter((u) => sent.push(u), () => t);
  assert.equal(rep("a/b", "1.0"), true);
  t += 200;
  assert.equal(rep("a/b", "1.0"), false); // 双击
  assert.equal(rep("a/b", "2.0"), true); // 另一个版本不受影响
  assert.equal(rep("c/d", "1.0"), true);
  t += 2000;
  assert.equal(rep("a/b", "1.0"), true);
  assert.deepEqual(sent, ["/api/dl?p=a%2Fb&v=1.0", "/api/dl?p=a%2Fb&v=2.0", "/api/dl?p=c%2Fd&v=1.0", "/api/dl?p=a%2Fb&v=1.0"]);
});

test("上报出错不影响下载(不抛出)", () => {
  const rep = createDownloadReporter(() => { throw new Error("offline"); });
  assert.doesNotThrow(() => rep("a/b", "1.0"));
});

test("左键、Ctrl/⌘ 点击与中键点击各记一次;右键不记", () => {
  const calls: string[] = [];
  const h = downloadLinkHandlers("a/b", "1.0", (id, v) => { calls.push(`${id}@${v}`); return true; });
  h.onClick({ button: 0 }); // 左键(含带修饰键的左键,button 仍是 0)
  h.onAuxClick({ button: 1 }); // 中键
  h.onAuxClick({ button: 2 }); // 右键:只弹菜单
  h.onClick({ button: 2 });
  assert.deepEqual(calls, ["a/b@1.0", "a/b@1.0"]);
});

test("下载次数汇总:只接受非负整数,单条不对就跳过这一条", () => {
  const s = parseDlStats({
    generatedAt: "2026-11-17T00:00:00Z",
    total: 12,
    today: 3,
    plugins: { "a/b": { total: 10, today: 3 }, "c/d": { total: 2, today: 0 }, "e/f": { total: -1, today: 0 }, "Bad Key": { total: 1, today: 1 }, "g/h": "x" },
  });
  assert.deepEqual(s, { total: 12, today: 3, plugins: { "a/b": { total: 10, today: 3 }, "c/d": { total: 2, today: 0 } } });
  for (const bad of [null, "x", [], {}, { total: 1, today: 0 }, { total: "1", today: 0, plugins: {} }, { total: 1, today: 0, plugins: [] }, { total: 1.5, today: 0, plugins: {} }]) {
    assert.equal(parseDlStats(bad), null);
  }
});

test("没有数据或为 0 时不显示", () => {
  const s = parseDlStats({ total: 5, today: 0, plugins: { "a/b": { total: 5, today: 0 }, "c/d": { total: 0, today: 0 } } });
  assert.equal(siteDownloadsOf(s, "a/b"), 5);
  assert.equal(siteDownloadsOf(s, "c/d"), null);
  assert.equal(siteDownloadsOf(s, "x/y"), null);
  assert.equal(siteDownloadsOf(s, "__proto__"), null);
  assert.equal(siteDownloadsOf(null, "a/b"), null);
});

test("本站下载显示:实时汇总里有这个插件时以它为准,没有时用插件数据里每日刷新写入的数", () => {
  const s = parseDlStats({ total: 9, today: 1, plugins: { "a/b": { total: 9, today: 1 } } });
  assert.equal(siteDownloadsOf(s, "a/b", 4), 9);
  assert.equal(siteDownloadsOf(s, "c/d", 4), 4);
  assert.equal(siteDownloadsOf(null, "a/b", 4), 4);
  assert.equal(siteDownloadsOf(null, "a/b", 0), null);
  assert.equal(siteDownloadsOf(null, "a/b", undefined), null);
});
