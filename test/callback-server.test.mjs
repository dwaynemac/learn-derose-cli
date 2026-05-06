import assert from "node:assert/strict";
import { test } from "node:test";

import { waitForAuthorizationCode } from "../src/callback-server.mjs";

test("callback server rejects non-loopback redirect hosts", async () => {
  await assert.rejects(
    () => waitForAuthorizationCode({
      redirectUri: "http://0.0.0.0:8787/callback",
      state: "state-123",
      timeoutMs: 10
    }),
    /only supports local loopback http redirect URIs/
  );
});
