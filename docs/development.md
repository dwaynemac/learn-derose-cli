# Development Notes

This document is for developers maintaining the `learn-derose` CLI.

The CLI authenticates with Learn OAuth and manages bookings through Learn's
documented `/api/v1` JSON API.

## Source Of Truth

The Learn Rails app is the API source of truth:

- `/Users/dwaynemac/GitHub/escuelaonline/docs/api_v1.md`
- `/Users/dwaynemac/GitHub/escuelaonline/docs/oauth_provider.md`

Before changing OAuth, scopes, endpoints, payloads, or API error handling, read
those docs and keep this CLI, tests, README, and agent skill aligned.

## OAuth Setup

Create an OAuth application in Learn with this redirect URI:

```text
http://localhost:8787/callback
```

Request these scopes for booking agents:

```text
openid email profile bookings:read bookings:write
```

Public clients should use PKCE. The CLI always uses PKCE with S256.

For confidential clients, pass `--client-secret` or set
`LEARN_DEROSE_CLIENT_SECRET`. The config file is written with `0600`
permissions.

## Package Usage

End users run the published package with `npx`:

```bash
npx --yes learn-derose auth login
```

Or install it globally:

```bash
npm install --global learn-derose
learn-derose auth login
```

## Local Development

Inside this repo, use asdf-managed Node.js:

```bash
ASDF_NODEJS_VERSION=20.20.0 asdf exec node bin/learn-derose.mjs --help
ASDF_NODEJS_VERSION=20.20.0 asdf exec npm test
```

Local CLI smoke checks can also use:

```bash
npx . --help
```

## Environment Variables

The CLI can read these environment variables instead of command-line flags:

| Variable | Purpose |
|---|---|
| `LEARN_DEROSE_CLIENT_ID` | OAuth client ID override for `auth login` |
| `LEARN_DEROSE_CLIENT_SECRET` | OAuth client secret for confidential clients |
| `LEARN_DEROSE_ISSUER` | OAuth issuer URL |
| `LEARN_DEROSE_API_BASE_URL` | Learn API base URL |
| `LEARN_DEROSE_REDIRECT_URI` | Local OAuth callback redirect URI |
| `LEARN_DEROSE_CONFIG` | Config file path |
| `LEARN_DEROSE_PROFILE` | Profile name |
| `LEARN_DEROSE_DEBUG` | Set to `1` or `true` to enable diagnostic logs |

## Logging And Troubleshooting

Use either flag for request-level logs:

```bash
npx --yes learn-derose auth login --verbose
LEARN_DEROSE_DEBUG=1 npx --yes learn-derose bookings list --json
```

Logs include the issuer, callback URL, and HTTP method/status. They do not print
access tokens, refresh tokens, authorization codes, client secrets, or PKCE
verifiers.

If `auth login` opens the browser and then fails with a token request error,
the browser authorization succeeded but the CLI could not exchange the code at
`/oauth/token`. For local `mkcert` domains, Node may not trust the same local CA
as your browser. Run with:

```bash
NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem" npx --yes learn-derose auth login --verbose
```

## Agent Skill

The repo-local booking skill lives at:

```text
skills/learn-derose-cli/SKILL.md
```

Keep it oriented to the user task: managing the user's own Learn DeROSE
bookings. Do not turn it into a developer API reference.
