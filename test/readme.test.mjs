import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("README documents an executable npx source before npm publication", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

  assert.match(readme, /npx --yes github:dwaynemac\/learn-derose-cli auth login/);
  assert.doesNotMatch(readme, /^npx learn-derose auth login$/m);
});
