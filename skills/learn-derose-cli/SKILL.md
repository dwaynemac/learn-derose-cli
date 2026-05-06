---
name: learn-derose-cli
description: Help a Learn DeROSE user manage their own class bookings with the `learn-derose` CLI. Use when the user wants to see available Learn classes, check their current or past bookings, book a class, join a waitlist, cancel a booking, sign in to Learn for CLI booking access, or troubleshoot booking-management commands.
---

# Learn DeROSE CLI

## Overview

Use this CLI when the user wants help managing their Learn DeROSE class schedule from the terminal or through an agent. The normal flow is: sign in once, list available classes, review bookings, book a class, or cancel a booking.

Prefer `--json` when you need reliable structured output. Keep diagnostics on stderr, and never expose OAuth tokens, authorization codes, client secrets, or PKCE verifiers.

If the command is installed, use `learn-derose`. Otherwise run the GitHub package:

```bash
npx --yes github:dwaynemac/learn-derose-cli --help
```

When working inside this repo, use asdf Node and the local package:

```bash
asdf exec node bin/learn-derose.mjs --help
```

## Workflow

1. Understand the user's booking task: available classes, active bookings, booking history, booking creation, waitlist, or cancellation.
2. Check sign-in status before managing bookings:

```bash
npx --yes github:dwaynemac/learn-derose-cli auth status --json
```

3. If the user is not signed in, start login and let them complete the browser step:

```bash
npx --yes github:dwaynemac/learn-derose-cli auth login
```

4. Run the booking command that matches the user's intent. Use `--json` for agent/script workflows and parse stdout only.
5. Add `--verbose` or `--debug` only when troubleshooting; those logs go to stderr.

## User Tasks

Show available classes:

```bash
learn-derose classes list [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--account-id ID] [--teacher-id ID] [--presence-type online|in_person] [--json]
```

Show the user's bookings:

```bash
learn-derose bookings list [--state active|history|all] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--json]
learn-derose bookings show BOOKING_ID [--json]
```

Book or cancel a class:

```bash
learn-derose bookings create --post-id POST_ID --date YYYY-MM-DD [--waitlist] [--json]
learn-derose bookings cancel BOOKING_ID [--json]
```

Manage sign-in:

```bash
learn-derose auth login [--client-id CLIENT_ID] [--client-secret SECRET]
learn-derose auth status [--json]
learn-derose auth logout [--revoke]
```

Use `--date` for booking creation. It maps to the API's `booked_date`.

## Examples

List classes for a date range:

```bash
npx --yes github:dwaynemac/learn-derose-cli classes list --from 2026-05-05 --to 2026-05-10 --json
```

List active bookings:

```bash
npx --yes github:dwaynemac/learn-derose-cli bookings list --state active --json
```

Create and cancel a booking:

```bash
npx --yes github:dwaynemac/learn-derose-cli bookings create --post-id 123 --date 2026-05-06 --json
npx --yes github:dwaynemac/learn-derose-cli bookings cancel 987 --json
```

## Configuration

Useful environment variables:

- `LEARN_DEROSE_CLIENT_ID`: OAuth client ID for `auth login`.
- `LEARN_DEROSE_CLIENT_SECRET`: OAuth client secret for confidential clients.
- `LEARN_DEROSE_ISSUER`: OAuth issuer URL.
- `LEARN_DEROSE_API_BASE_URL`: Learn API base URL.
- `LEARN_DEROSE_REDIRECT_URI`: Local OAuth callback redirect URI.
- `LEARN_DEROSE_CONFIG`: Config file path.
- `LEARN_DEROSE_PROFILE`: Profile name.
- `LEARN_DEROSE_DEBUG`: Set to `1` or `true` for stderr diagnostics.

Default production API base is `https://learn.derose.app/api/v1`. Default booking-agent scopes are `openid email profile bookings:read bookings:write`.

For local Learn development against `https://learn.padma.test`, Node may need the mkcert CA:

```bash
NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem" npx --yes github:dwaynemac/learn-derose-cli auth login --verbose
```

## Guardrails

- Keep JSON stdout valid and free of logs when `--json` is used.
- Report stderr diagnostics separately from parsed JSON output.
- Do not print secrets from config files, environment variables, OAuth responses, or verbose logs.
- Do not pass or invent user IDs; the API scopes bookings to the OAuth token owner.
- Treat `bookings:read` and `bookings:write` as separate OAuth scopes.
- Before changing OAuth, scopes, endpoints, payloads, or API error handling, read `/Users/dwaynemac/GitHub/escuelaonline/docs/api_v1.md` and `/Users/dwaynemac/GitHub/escuelaonline/docs/oauth_provider.md`, then update this CLI, tests, README, and this skill together.
