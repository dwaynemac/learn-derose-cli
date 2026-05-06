import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { runCli } from "../src/cli.mjs";

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

async function withConfig(profile, callback) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "learn-derose-cli-"));
  const configPath = path.join(directory, "config.json");

  await writeFile(
    configPath,
    JSON.stringify({
      activeProfile: "default",
      profiles: {
        default: profile
      }
    })
  );

  try {
    await callback(configPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("auth without a subcommand returns an actionable error", async () => {
  let stdout = "";
  let stderr = "";

  const exitCode = await runCli(["auth"], {
    stdout: { write: (value) => { stdout += value; } },
    stderr: { write: (value) => { stderr += value; } },
    env: {}
  });

  assert.equal(exitCode, 1);
  assert.equal(stdout, "");
  assert.equal(
    stderr,
    "Error: Missing auth command. Use `learn-derose auth login`, `learn-derose auth status`, or `learn-derose auth logout`.\n"
  );
});

test("help command is equivalent to --help", async () => {
  let helpStdout = "";
  let commandStdout = "";

  const helpExitCode = await runCli(["--help"], {
    stdout: { write: (value) => { helpStdout += value; } },
    stderr: { write: () => {} },
    env: {}
  });
  const commandExitCode = await runCli(["help"], {
    stdout: { write: (value) => { commandStdout += value; } },
    stderr: { write: () => {} },
    env: {}
  });

  assert.equal(helpExitCode, 0);
  assert.equal(commandExitCode, 0);
  assert.equal(commandStdout, helpStdout);
});

test("help omits environment variable reference details", async () => {
  let stdout = "";

  const exitCode = await runCli(["help"], {
    stdout: { write: (value) => { stdout += value; } },
    stderr: { write: () => {} },
    env: {}
  });

  assert.equal(exitCode, 0);
  assert.doesNotMatch(stdout, /OAuth environment/);
  assert.doesNotMatch(stdout, /LEARN_DEROSE_CLIENT_ID/);
});

test("help omits OAuth client override details", async () => {
  let stdout = "";

  const exitCode = await runCli(["help"], {
    stdout: { write: (value) => { stdout += value; } },
    stderr: { write: () => {} },
    env: {}
  });

  assert.equal(exitCode, 0);
  assert.match(stdout, /learn-derose auth login/);
  assert.doesNotMatch(stdout, /--client-id/);
  assert.doesNotMatch(stdout, /--client-secret/);
});

test("help omits endpoint override details", async () => {
  let stdout = "";

  const exitCode = await runCli(["help"], {
    stdout: { write: (value) => { stdout += value; } },
    stderr: { write: () => {} },
    env: {}
  });

  assert.equal(exitCode, 0);
  assert.doesNotMatch(stdout, /--issuer/);
  assert.doesNotMatch(stdout, /--api-base-url/);
});

test("help includes the account filter for class listing", async () => {
  let stdout = "";

  const exitCode = await runCli(["help"], {
    stdout: { write: (value) => { stdout += value; } },
    stderr: { write: () => {} },
    env: {}
  });

  assert.equal(exitCode, 0);
  assert.match(stdout, /--account-id ID/);
});

test("help includes the requires booking filter for class listing", async () => {
  let stdout = "";

  const exitCode = await runCli(["help"], {
    stdout: { write: (value) => { stdout += value; } },
    stderr: { write: () => {} },
    env: {}
  });

  assert.equal(exitCode, 0);
  assert.match(stdout, /--requires-booking/);
});

test("auth logout --revoke revokes access and refresh tokens", async () => {
  const profile = {
    issuer: "https://learn.derose.app",
    apiBaseUrl: "https://learn.derose.app/api/v1",
    clientId: "client-123",
    token: {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: "2026-05-05T11:00:00.000Z"
    }
  };

  await withConfig(profile, async (configPath) => {
    const calls = [];
    let stdout = "";
    let stderr = "";

    const exitCode = await runCli(["auth", "logout", "--revoke", "--config", configPath], {
      fetch: async (url, options) => {
        calls.push({ url: String(url), options });
        return jsonResponse({});
      },
      stdout: { write: (value) => { stdout += value; } },
      stderr: { write: (value) => { stderr += value; } },
      env: {}
    });

    const savedConfig = JSON.parse(await readFile(configPath, "utf8"));

    assert.equal(exitCode, 0);
    assert.equal(stderr, "");
    assert.equal(stdout, "Logged out of Learn.\n");
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, "https://learn.derose.app/oauth/revoke");
    assert.equal(String(calls[0].options.body), "token=access-token&client_id=client-123");
    assert.equal(String(calls[1].options.body), "token=refresh-token&client_id=client-123");
    assert.equal(savedConfig.profiles.default.token, undefined);
  });
});

test("bookings cancel uses the stored OAuth token and prints JSON for agents", async () => {
  const profile = {
    issuer: "https://learn.derose.app",
    apiBaseUrl: "https://learn.derose.app/api/v1",
    clientId: "client-123",
    token: {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: "2026-05-05T11:00:00.000Z"
    }
  };

  await withConfig(profile, async (configPath) => {
    const calls = [];
    let stdout = "";
    let stderr = "";

    const exitCode = await runCli(
      ["bookings", "cancel", "987", "--json", "--config", configPath],
      {
        now: () => new Date("2026-05-05T10:00:00.000Z"),
        fetch: async (url, options) => {
          calls.push({ url: String(url), options });
          return jsonResponse({ data: { id: 987, status: "cancelled" } });
        },
        stdout: { write: (value) => { stdout += value; } },
        stderr: { write: (value) => { stderr += value; } },
        env: {}
      }
    );

    assert.equal(exitCode, 0);
    assert.equal(stderr, "");
    assert.deepEqual(JSON.parse(stdout), { data: { id: 987, status: "cancelled" } });
    assert.equal(calls[0].url, "https://learn.derose.app/api/v1/bookings/987");
    assert.equal(calls[0].options.method, "DELETE");
    assert.equal(calls[0].options.headers.Authorization, "Bearer access-token");
  });
});

test("verbose mode logs request diagnostics without secrets", async () => {
  const profile = {
    issuer: "https://learn.derose.app",
    apiBaseUrl: "https://learn.derose.app/api/v1",
    clientId: "client-123",
    token: {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: "2026-05-05T11:00:00.000Z"
    }
  };

  await withConfig(profile, async (configPath) => {
    let stdout = "";
    let stderr = "";

    const exitCode = await runCli(
      ["bookings", "cancel", "987", "--json", "--verbose", "--config", configPath],
      {
        now: () => new Date("2026-05-05T10:00:00.000Z"),
        fetch: async () => jsonResponse({ data: { id: 987, status: "cancelled" } }),
        stdout: { write: (value) => { stdout += value; } },
        stderr: { write: (value) => { stderr += value; } },
        env: {}
      }
    );

    assert.equal(exitCode, 0);
    assert.deepEqual(JSON.parse(stdout), { data: { id: 987, status: "cancelled" } });
    assert.match(stderr, /\[learn-derose\] Using profile default/);
    assert.match(stderr, /\[learn-derose\] HTTP DELETE https:\/\/learn\.derose\.app\/api\/v1\/bookings\/987/);
    assert.match(stderr, /\[learn-derose\] HTTP DELETE https:\/\/learn\.derose\.app\/api\/v1\/bookings\/987 -> 200/);
    assert.doesNotMatch(stderr, /access-token/);
    assert.doesNotMatch(stderr, /refresh-token/);
  });
});

test("bookings create maps CLI flags to the API booking body", async () => {
  const profile = {
    issuer: "https://learn.derose.app",
    apiBaseUrl: "https://learn.derose.app/api/v1",
    clientId: "client-123",
    token: {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: "2026-05-05T11:00:00.000Z"
    }
  };

  await withConfig(profile, async (configPath) => {
    const calls = [];
    let stdout = "";

    const exitCode = await runCli(
      [
        "bookings",
        "create",
        "--post-id",
        "123",
        "--date",
        "2026-05-06",
        "--waitlist",
        "--json",
        "--config",
        configPath
      ],
      {
        now: () => new Date("2026-05-05T10:00:00.000Z"),
        fetch: async (url, options) => {
          calls.push({ url: String(url), options });
          return jsonResponse({ data: { id: 987 } }, { status: 201 });
        },
        stdout: { write: (value) => { stdout += value; } },
        stderr: { write: () => {} },
        env: {}
      }
    );

    assert.equal(exitCode, 0);
    assert.deepEqual(JSON.parse(stdout), { data: { id: 987 } });
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      booking: {
        post_id: 123,
        booked_date: "2026-05-06",
        waitlist: true
      }
    });
  });
});

test("classes list forwards class filters and prints teacher names", async () => {
  const profile = {
    issuer: "https://learn.derose.app",
    apiBaseUrl: "https://learn.derose.app/api/v1",
    clientId: "client-123",
    token: {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: "2026-05-05T11:00:00.000Z"
    }
  };

  await withConfig(profile, async (configPath) => {
    const calls = [];
    let stdout = "";

    const exitCode = await runCli(
      [
        "classes",
        "list",
        "--from",
        "2026-05-05",
        "--to",
        "2026-05-10",
        "--teacher-id",
        "42",
        "--requires-booking",
        "--config",
        configPath
      ],
      {
        now: () => new Date("2026-05-05T10:00:00.000Z"),
        fetch: async (url, options) => {
          calls.push({ url: String(url), options });
          return jsonResponse({
            data: [
              {
                post_id: 123,
                booked_date: "2026-05-06",
                starts_at: "2026-05-06T10:00:00-03:00",
                presence_type: "online",
                title: "Morning practice",
                account: { name: "DeROSE Palermo" },
                teacher: { id: 42, name: "Ana Gomez" },
                available_spots: 3
              }
            ]
          });
        },
        stdout: { write: (value) => { stdout += value; } },
        stderr: { write: () => {} },
        env: {}
      }
    );

    assert.equal(exitCode, 0);
    assert.equal(
      calls[0].url,
      "https://learn.derose.app/api/v1/classes?from=2026-05-05&to=2026-05-10&teacher_id=42&requires_booking=true"
    );
    assert.match(stdout, /Teacher/);
    assert.match(stdout, /Ana Gomez/);
  });
});
