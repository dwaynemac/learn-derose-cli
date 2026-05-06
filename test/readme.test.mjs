import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("docs document the published npm package usage", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const development = await readFile(new URL("../docs/development.md", import.meta.url), "utf8");
  const skill = await readFile(new URL("../skills/learn-derose-cli/SKILL.md", import.meta.url), "utf8");

  assert.match(readme, /npx --yes learn-derose auth login/);
  assert.match(development, /npx --yes learn-derose auth login/);
  assert.match(skill, /npx --yes learn-derose auth login/);

  for (const content of [readme, development, skill]) {
    assert.doesNotMatch(content, /github:dwaynemac\/learn-derose-cli/);
    assert.doesNotMatch(content, /not published to npm/i);
  }
});
