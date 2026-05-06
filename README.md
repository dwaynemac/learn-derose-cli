# learn-derose

CLI for authenticating with Learn OAuth and managing bookings through the
documented `/api/v1` JSON API.

## OAuth setup

Create an OAuth application in Learn with this redirect URI:

```text
http://localhost:8787/callback
```

Request these scopes for booking agents:

```text
openid email profile bookings:read bookings:write
```

Public clients should use PKCE. The CLI always uses PKCE with S256.

## Usage

The package is not published to npm yet. Run it from the GitHub repo:

```bash
npx --yes github:dwaynemac/learn-derose-cli auth login
npx --yes github:dwaynemac/learn-derose-cli classes list --from 2026-05-05 --to 2026-05-10 --json
npx --yes github:dwaynemac/learn-derose-cli classes list --teacher-id 42 --json
npx --yes github:dwaynemac/learn-derose-cli bookings list --state active --json
npx --yes github:dwaynemac/learn-derose-cli bookings create --post-id 123 --date 2026-05-06 --json
npx --yes github:dwaynemac/learn-derose-cli bookings cancel 987 --json
```

Add `--verbose` to print request diagnostics to stderr. For agents, this keeps
JSON on stdout and logs on stderr.

For confidential clients, pass `--client-secret` or set
`LEARN_DEROSE_CLIENT_SECRET`. The config file is written with `0600`
permissions.

Local development can run the package directly:

```bash
npx . --help
```

## Commands

```bash
learn-derose auth login [--client-id CLIENT_ID] [--client-secret SECRET]
learn-derose auth status [--json]
learn-derose auth logout [--revoke]

learn-derose classes list \
  [--from YYYY-MM-DD] \
  [--to YYYY-MM-DD] \
  [--account-id ID] \
  [--teacher-id ID] \
  [--presence-type online|in_person] \
  [--json]

learn-derose bookings list \
  [--state active|history|all] \
  [--from YYYY-MM-DD] \
  [--to YYYY-MM-DD] \
  [--json]

learn-derose bookings show BOOKING_ID [--json]

learn-derose bookings create \
  --post-id POST_ID \
  --date YYYY-MM-DD \
  [--waitlist] \
  [--json]

learn-derose bookings cancel BOOKING_ID [--json]
```

Use `--json` for AI agents and scripts.

## Environment variables

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

## Logging and troubleshooting

Use either flag for request-level logs:

```bash
npx --yes github:dwaynemac/learn-derose-cli auth login --verbose
LEARN_DEROSE_DEBUG=1 npx --yes github:dwaynemac/learn-derose-cli bookings list --json
```

Logs include the issuer, callback URL, and HTTP method/status. They do not print
access tokens, refresh tokens, authorization codes, client secrets, or PKCE
verifiers.

If `auth login` opens the browser and then fails with a token request error,
the browser authorization succeeded but the CLI could not exchange the code at
`/oauth/token`. For local `mkcert` domains, Node may not trust the same local CA
as your browser. Run with:

```bash
NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem" npx --yes github:dwaynemac/learn-derose-cli auth login --verbose
```
