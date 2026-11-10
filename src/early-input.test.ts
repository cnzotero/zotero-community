import { test } from "node:test";
import assert from "node:assert/strict";
import { captureEarlyInputs, takeEarlyInput } from "./ssr.ts";

test("接管前在搜索框里输入的文字:记下后可取回一次,空输入框不记", () => {
  const inputs = [
    { value: "翻译", dataset: { early: "plugins-q" } },
    { value: "", dataset: { early: "home-q" } },
  ];
  const root = { querySelectorAll: (sel: string) => (sel === "input[data-early]" ? inputs : []) } as unknown as ParentNode;
  captureEarlyInputs(root);
  assert.equal(takeEarlyInput("plugins-q"), "翻译");
  assert.equal(takeEarlyInput("plugins-q"), ""); // 只取一次
  assert.equal(takeEarlyInput("home-q"), "");
});
