import assert from "node:assert/strict";
import { test } from "node:test";

import { createAccessTokenProvider, tokenFromResponse } from "../src/session.mjs";

function jsonResponse(body, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    }
  };
}

test("createAccessTokenProvider refreshes expired OAuth tokens", async () => {
  const profile = {
    issuer: "https://learn.derose.app",
    clientId: "client-123",
    clientSecret: "secret-123",
    token: {
      accessToken: "old-token",
      refreshToken: "refresh-token",
      expiresAt: "2026-05-05T10:00:00.000Z"
    }
  };
  const savedProfiles = [];
  const calls = [];

  const getAccessToken = createAccessTokenProvider({
    profile,
    now: () => new Date("2026-05-05T10:01:00.000Z"),
    saveProfile: async (updatedProfile) => savedProfiles.push(structuredClone(updatedProfile)),
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });
      return jsonResponse({
        access_token: "new-token",
        refresh_token: "new-refresh-token",
        token_type: "Bearer",
        expires_in: 3600,
        scope: "openid bookings:read bookings:write"
      });
    }
  });

  assert.equal(await getAccessToken(), "new-token");
  assert.equal(savedProfiles.length, 1);
  assert.equal(profile.token.accessToken, "new-token");
  assert.equal(profile.token.refreshToken, "new-refresh-token");
  assert.equal(profile.token.expiresAt, "2026-05-05T11:01:00.000Z");
  assert.equal(calls[0].url, "https://learn.derose.app/oauth/token");
  assert.equal(calls[0].options.method, "POST");
  assert.match(String(calls[0].options.body), /grant_type=refresh_token/);
  assert.match(String(calls[0].options.body), /refresh_token=refresh-token/);
  assert.match(String(calls[0].options.body), /client_id=client-123/);
  assert.match(String(calls[0].options.body), /client_secret=secret-123/);
});

test("createAccessTokenProvider reuses a valid access token", async () => {
  const profile = {
    issuer: "https://learn.derose.app",
    clientId: "client-123",
    token: {
      accessToken: "current-token",
      refreshToken: "refresh-token",
      expiresAt: "2026-05-05T10:10:00.000Z"
    }
  };
  let refreshCalled = false;

  const getAccessToken = createAccessTokenProvider({
    profile,
    now: () => new Date("2026-05-05T10:01:00.000Z"),
    saveProfile: async () => {},
    fetch: async () => {
      refreshCalled = true;
      return jsonResponse({});
    }
  });

  assert.equal(await getAccessToken(), "current-token");
  assert.equal(refreshCalled, false);
});

test("tokenFromResponse rejects OAuth responses without an access token", () => {
  assert.throws(
    () => tokenFromResponse({
      refresh_token: "new-refresh-token",
      expires_in: 3600
    }, {
      previousToken: {
        accessToken: "expired-token",
        refreshToken: "refresh-token"
      },
      now: () => new Date("2026-05-05T10:01:00.000Z")
    }),
    /OAuth token response did not include an access token/
  );
});
