# Project Guidelines

## Product Context

- This repo is the standalone `learn-derose` CLI client for Learn's documented `/api/v1` JSON API.
- The Learn Rails app source of truth is `/Users/dwaynemac/GitHub/escuelaonline`.
- Before changing OAuth, scopes, endpoints, payloads, or API error handling, read:
  - `/Users/dwaynemac/GitHub/escuelaonline/docs/api_v1.md`
  - `/Users/dwaynemac/GitHub/escuelaonline/docs/oauth_provider.md`
- Keep this CLI aligned with the Learn API contract. If behavior changes in the Rails app, update this CLI, its tests, and its README together.

## Runtime

- Always use asdf-installed Node.js.
- If `.tool-versions` is present, use the Node.js version specified there.
- If `.tool-versions` is absent, choose an installed asdf Node.js version that satisfies `package.json` `engines.node`.
- This package is ESM (`"type": "module"`) and should stay dependency-light.
- Prefer built-in Node APIs unless a dependency clearly removes real complexity.

## Commands

- Run tests with `asdf exec npm test`.
- If asdf has no version selected, run with an explicit installed Node version, for example:
  `ASDF_NODEJS_VERSION=20.20.0 asdf exec npm test`.
- The test script uses Node's built-in test runner: `node --test test/*.test.mjs`.
- Local CLI smoke checks can use `asdf exec node bin/learn-derose.mjs --help`.

## Engineering Style

- Act like a high-performing senior engineer: concise, direct, and execution-focused.
- Prefer simple, maintainable, production-friendly solutions.
- Keep code low-complexity and easy to read, debug, and modify.
- Keep APIs small, behavior explicit, and names clear.
- Avoid cleverness, broad refactors, heavy abstractions, and new dependencies unless they clearly solve proven complexity.
- Add comments only when they clarify non-obvious behavior or intent.
- For non-trivial changes, pause and ask: "is there a more elegant way?"
- If a fix feels hacky, rethink it and implement the cleaner solution.
- Find root causes. Do not ship temporary fixes for production bugs.

## Bug Workflow

- When fixing a bug, first add a focused failing test that reproduces the bug.
- After the failing test exists, patch the implementation and prove the fix with a passing test.
- For non-trivial bugs, use subagents to try fixes only after the reproduction is in place.

## CLI Contracts

- `--json` output is for AI agents and scripts. Keep JSON stdout valid and free of logs.
- Verbose and debug diagnostics must go to stderr only.
- Never print access tokens, refresh tokens, authorization codes, client secrets, or PKCE verifiers.
- Keep runtime help concise for users and agents. Long-form OAuth environment details and troubleshooting belong in `README.md`.
- Treat `help` as equivalent to `--help`.
- Keep command-boundary errors actionable, especially for incomplete commands like `learn-derose auth`.
- Prefer short user-facing flags when clear. `--date` is the public booking-create flag and maps to the API's `booked_date`.

## OAuth And API Rules

- Public clients must use PKCE with S256.
- Default booking-agent scopes are `openid email profile bookings:read bookings:write`.
- `bookings:read` and `bookings:write` are separate; do not assume write implies read.
- The API acts as the OAuth token owner. Do not add or rely on user-id input in this client.
- Production API base URL is `https://learn.derose.app/api/v1`.
- Local development against `https://learn.padma.test` may require:
  `NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem"`.

## Testing Expectations

- Add or update tests for all behavior changes.
- Prefer focused unit tests around `src/` modules and CLI command behavior in `test/cli.test.mjs`.
- For API contract changes, test request method, path, query/body mapping, auth headers, output format, and error handling.
- Review the diff before finishing. Look for accidental stdout noise, secret leakage, stale docs, missing tests, and API-doc drift.
