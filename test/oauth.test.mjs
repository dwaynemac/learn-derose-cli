import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_CLIENT_ID,
  DEFAULT_SCOPE,
  buildAuthorizationUrl,
  createCodeChallenge,
  exchangeAuthorizationCode
} from "../src/oauth.mjs";

test("buildAuthorizationUrl creates a Learn PKCE authorization URL", async () => {
  const url = buildAuthorizationUrl({
    issuer: "https://learn.derose.app/",
    clientId: "client-123",
    redirectUri: "http://localhost:8787/callback",
    scope: DEFAULT_SCOPE,
    state: "state-123",
    codeChallenge: "challenge-123"
  });

  const parsed = new URL(url);

  assert.equal(parsed.origin, "https://learn.derose.app");
  assert.equal(parsed.pathname, "/oauth/authorize");
  assert.equal(parsed.searchParams.get("client_id"), "client-123");
  assert.equal(parsed.searchParams.get("redirect_uri"), "http://localhost:8787/callback");
  assert.equal(parsed.searchParams.get("response_type"), "code");
  assert.equal(parsed.searchParams.get("scope"), "openid email profile bookings:read bookings:write");
  assert.equal(parsed.searchParams.get("state"), "state-123");
  assert.equal(parsed.searchParams.get("code_challenge"), "challenge-123");
  assert.equal(parsed.searchParams.get("code_challenge_method"), "S256");
  assert.equal(parsed.searchParams.has("client_secret"), false);
});

test("createCodeChallenge returns the OAuth S256 base64url digest", async () => {
  assert.equal(
    await createCodeChallenge("learn-derose-test-verifier"),
    "37UTSFMak09hr362dl108Q1fgaoXnxhGeT09LffuWUk"
  );
});

test("buildAuthorizationUrl uses the packaged default client id", async () => {
  const url = buildAuthorizationUrl({
    issuer: "https://learn.derose.app/",
    redirectUri: "http://localhost:8787/callback",
    scope: DEFAULT_SCOPE,
    state: "state-123",
    codeChallenge: "challenge-123"
  });

  assert.equal(new URL(url).searchParams.get("client_id"), DEFAULT_CLIENT_ID);
  assert.equal(DEFAULT_CLIENT_ID, "xqerTj2buGDRMTf03q-QO2E6F7su-WrAESCHnK7BsxM");
});

test("exchangeAuthorizationCode wraps token endpoint fetch failures with diagnostics", async () => {
  const cause = new Error("self-signed certificate");
  cause.code = "DEPTH_ZERO_SELF_SIGNED_CERT";

  await assert.rejects(
    () => exchangeAuthorizationCode({
      issuer: "https://learn.padma.test",
      clientId: "client-123",
      code: "auth-code",
      redirectUri: "http://localhost:8787/callback",
      codeVerifier: "code-verifier",
      fetch: async () => {
        throw new TypeError("fetch failed", { cause });
      }
    }),
    (error) => {
      assert.match(error.message, /Could not reach Learn OAuth token endpoint/);
      assert.match(error.message, /https:\/\/learn\.padma\.test\/oauth\/token/);
      assert.match(error.message, /self-signed certificate/);
      assert.match(error.message, /NODE_EXTRA_CA_CERTS/);
      return true;
    }
  );
});
