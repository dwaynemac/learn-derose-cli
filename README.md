# learn-derose

Command-line access to your Learn DeROSE classes and bookings.

Use this CLI if you are a Learn DeROSE student or user who wants to sign in to
Learn, see available classes, check your bookings, book a class, join a
waitlist, or cancel a booking.

## Install on your AI Agent

```bash
npx skills add dwaynemac/learn-derose-cli
```

## CLI Quick Start

Run it with `npx`:

```bash
npx learn-derose auth login
```

Your browser will open so you can sign in to Learn. After that, you can manage
your own bookings from the terminal.

If you prefer to install it once:

```bash
npm install --global learn-derose
learn-derose auth login
```

## Common Tasks

See available classes:

```bash
npx learn-derose classes list --from YYYY-MM-DD --to YYYY-MM-DD
```

Filter classes by teacher:

```bash
npx learn-derose classes list --teacher-id 42
```

See your active bookings:

```bash
npx learn-derose bookings list --state active
```

Book a class:

```bash
npx learn-derose bookings create --post-id POST_ID --date YYYY-MM-DD
```

Use the `post_id` shown by `classes list`.

Join the waitlist for a class:

```bash
npx learn-derose bookings create --post-id POST_ID --date YYYY-MM-DD --waitlist
```

Cancel a booking:

```bash
npx learn-derose bookings cancel BOOKING_ID
```

Use the booking id shown by `bookings list`.

## Commands

```bash
learn-derose auth login
learn-derose auth status [--json]
learn-derose auth logout [--revoke]

learn-derose classes list [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--account-id ID] [--teacher-id ID] [--presence-type online|in_person] [--json]

learn-derose bookings list [--state active|history|all] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--json]
learn-derose bookings show BOOKING_ID [--json]
learn-derose bookings create --post-id POST_ID --date YYYY-MM-DD [--waitlist] [--json]
learn-derose bookings cancel BOOKING_ID [--json]
```

Use `help` or `--help` to see the current command list:

```bash
npx learn-derose help
```

## Using With Agents Or Scripts

Add `--json` when another tool or AI agent needs to read the output:

```bash
npx learn-derose bookings list --state active --json
```

This repo includes an agent skill for booking-management workflows:
[skills/learn-derose-cli](skills/learn-derose-cli/SKILL.md).

## Troubleshooting

If a command fails, rerun it with `--verbose`:

```bash
npx learn-derose bookings list --state active --verbose
```

Verbose logs are written separately from command output and do not print your
Learn access tokens or secrets.

Developer setup, OAuth app details, environment variables, and local
`learn.padma.test` troubleshooting live in
[docs/development.md](docs/development.md).
