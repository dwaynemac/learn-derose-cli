import { ConfigStore, defaultConfigPath } from "./config-store.mjs";
import { LearnDeroseApiClient } from "./api-client.mjs";
import { CliError } from "./errors.mjs";
import { formatBookings, formatClasses } from "./formatters.mjs";
import {
  DEFAULT_API_BASE_URL,
  DEFAULT_CLIENT_ID,
  DEFAULT_ISSUER,
  DEFAULT_REDIRECT_URI,
  DEFAULT_SCOPE,
  buildAuthorizationUrl,
  createPkcePair,
  createState,
  exchangeAuthorizationCode,
  normalizeBaseUrl,
  revokeToken
} from "./oauth.mjs";
import { createAccessTokenProvider, tokenFromResponse } from "./session.mjs";
import { waitForAuthorizationCode } from "./callback-server.mjs";
import { openUrl } from "./open-url.mjs";
import { createLogger, debugEnabled } from "./logger.mjs";

const BOOLEAN_FLAGS = new Set([
  "help",
  "json",
  "requiresBooking",
  "waitlist",
  "noOpen",
  "revoke",
  "verbose",
  "debug"
]);

export async function runCli(argv = process.argv.slice(2), deps = {}) {
  const stdout = deps.stdout || process.stdout;
  const stderr = deps.stderr || process.stderr;

  try {
    const parsed = parseArgs(argv);

    if (parsed.options.help || parsed.positionals.length === 0 || isHelpCommand(parsed.positionals)) {
      stdout.write(helpText());
      return 0;
    }

    const context = await createContext(parsed.options, deps);
    context.logger.debug(`Using profile ${context.profileName}`);
    const [resource, action, id] = parsed.positionals;

    if (resource === "auth") {
      return await handleAuth(action, parsed.options, context);
    }

    const client = await createApiClient(parsed.options, context);
    let payload;
    let formatter;

    if (resource === "classes" && action === "list") {
      payload = await client.listClasses(parsed.options);
      formatter = formatClasses;
    } else if (resource === "bookable-classes" && action === "list") {
      payload = await client.listBookableClasses(parsed.options);
      formatter = formatClasses;
    } else if (resource === "bookings" && action === "list") {
      payload = await client.listBookings(parsed.options);
      formatter = formatBookings;
    } else if (resource === "bookings" && action === "show") {
      requireArgument(id, "booking id");
      payload = await client.showBooking(id);
      formatter = formatBookings;
    } else if (resource === "bookings" && action === "create") {
      requireOption(parsed.options, "postId", "--post-id");
      const bookingDate = parsed.options.date || parsed.options.bookedDate;
      if (!bookingDate) throw new CliError("Missing required option --date.");
      payload = await client.createBooking({
        postId: parsed.options.postId,
        bookedDate: bookingDate,
        waitlist: parsed.options.waitlist
      });
      formatter = formatBookings;
    } else if (resource === "bookings" && action === "cancel") {
      requireArgument(id, "booking id");
      payload = await client.cancelBooking(id);
      formatter = formatBookings;
    } else {
      throw new CliError(`Unknown command: ${parsed.positionals.join(" ")}`);
    }

    writePayload(stdout, payload, {
      json: parsed.options.json,
      formatter
    });

    return 0;
  } catch (error) {
    stderr.write(`Error: ${error.message}\n`);
    return error.exitCode || 1;
  }
}

async function handleAuth(action, options, context) {
  if (!action) {
    throw new CliError("Missing auth command. Use `learn-derose auth login`, `learn-derose auth status`, or `learn-derose auth logout`.");
  }

  if (action === "login") {
    return login(options, context);
  }

  if (action === "status") {
    const profile = await loadProfile(options, context);
    const payload = {
      profile: context.profileName,
      issuer: profile.issuer,
      apiBaseUrl: profile.apiBaseUrl,
      clientId: profile.clientId,
      scope: profile.scope,
      authenticated: Boolean(profile.token?.accessToken),
      expiresAt: profile.token?.expiresAt || null
    };

    writePayload(context.stdout, payload, {
      json: options.json,
      formatter: () => formatStatus(payload)
    });
    return 0;
  }

  if (action === "logout") {
    const { config, profile } = await loadConfigAndProfile(options, context);

    if (options.revoke) {
      await revokeProfileTokens(profile, context);
    }

    delete profile.token;
    config.profiles[context.profileName] = profile;
    await context.store.save(config);
    context.stdout.write("Logged out of Learn.\n");
    return 0;
  }

  throw new CliError(`Unknown auth command: ${action || ""}`.trim());
}

async function revokeProfileTokens(profile, context) {
  const tokens = [
    profile.token?.accessToken,
    profile.token?.refreshToken
  ].filter(Boolean);

  for (const token of [...new Set(tokens)]) {
    await revokeToken({
      issuer: profile.issuer,
      clientId: profile.clientId,
      clientSecret: profile.clientSecret,
      token,
      fetch: context.fetch,
      logger: context.logger
    });
  }
}

async function login(options, context) {
  const issuer = normalizeBaseUrl(
    options.issuer || context.env.LEARN_DEROSE_ISSUER || DEFAULT_ISSUER
  );
  const apiBaseUrl = normalizeBaseUrl(
    options.apiBaseUrl || context.env.LEARN_DEROSE_API_BASE_URL || DEFAULT_API_BASE_URL
  );
  const clientId = options.clientId || context.env.LEARN_DEROSE_CLIENT_ID || DEFAULT_CLIENT_ID;
  const clientSecret = options.clientSecret || context.env.LEARN_DEROSE_CLIENT_SECRET;
  const redirectUri = options.redirectUri || context.env.LEARN_DEROSE_REDIRECT_URI || DEFAULT_REDIRECT_URI;
  const scope = options.scope || DEFAULT_SCOPE;

  const state = createState();
  const { codeVerifier, codeChallenge } = await createPkcePair();
  const authorizationUrl = buildAuthorizationUrl({
    issuer,
    clientId,
    redirectUri,
    scope,
    state,
    codeChallenge
  });

  context.stdout.write("Open this URL to authenticate with Learn:\n");
  context.stdout.write(`${authorizationUrl}\n\n`);
  context.logger.debug(`Issuer ${issuer}`);
  context.logger.debug(`API base URL ${apiBaseUrl}`);
  context.logger.debug(`OAuth redirect URI ${redirectUri}`);
  context.logger.debug(`OAuth scopes ${scope}`);
  context.logger.debug(`Starting OAuth callback server on ${redirectUri}`);

  const authorizationCode = waitForAuthorizationCode({
    redirectUri,
    state,
    timeoutMs: Number(options.callbackTimeoutSeconds || 300) * 1000
  });

  if (!options.noOpen) {
    context.logger.debug("Opening authorization URL in the browser");
    openUrl(authorizationUrl);
  } else {
    context.logger.debug("Browser auto-open disabled");
  }

  const code = await authorizationCode;
  context.logger.debug("OAuth callback received authorization code");
  context.logger.debug("Exchanging authorization code for access token");

  const tokenPayload = await exchangeAuthorizationCode({
    issuer,
    clientId,
    clientSecret,
    code,
    redirectUri,
    codeVerifier,
    fetch: context.fetch,
    logger: context.logger
  });

  const config = await context.store.load();
  const profile = {
    ...(config.profiles[context.profileName] || {}),
    issuer,
    apiBaseUrl,
    clientId,
    clientSecret,
    redirectUri,
    scope,
    token: tokenFromResponse(tokenPayload, { now: context.now })
  };

  config.activeProfile = context.profileName;
  config.profiles[context.profileName] = profile;
  await context.store.save(config);

  context.logger.debug(`Saved OAuth token profile to ${context.store.filePath}`);
  context.stdout.write(`Authenticated with Learn. Token saved to ${context.store.filePath}\n`);
  return 0;
}

async function createApiClient(options, context) {
  const { config, profile } = await loadConfigAndProfile(options, context);

  const getAccessToken = createAccessTokenProvider({
    profile,
    now: context.now,
    fetch: context.fetch,
    logger: context.logger,
    saveProfile: async (updatedProfile) => {
      config.profiles[context.profileName] = updatedProfile;
      await context.store.save(config);
    }
  });

  return new LearnDeroseApiClient({
    apiBaseUrl: profile.apiBaseUrl || DEFAULT_API_BASE_URL,
    getAccessToken,
    fetch: context.fetch,
    locale: options.locale,
    logger: context.logger
  });
}

async function loadProfile(options, context) {
  return (await loadConfigAndProfile(options, context)).profile;
}

async function loadConfigAndProfile(options, context) {
  const config = await context.store.load();
  const profile = config.profiles[context.profileName];

  if (!profile) {
    throw new CliError(`No Learn profile named "${context.profileName}" found. Run \`learn-derose auth login\` first.`);
  }

  const updatedProfile = {
    ...profile,
    issuer: normalizeBaseUrl(options.issuer || profile.issuer || DEFAULT_ISSUER),
    apiBaseUrl: normalizeBaseUrl(options.apiBaseUrl || profile.apiBaseUrl || DEFAULT_API_BASE_URL),
    clientId: options.clientId || context.env.LEARN_DEROSE_CLIENT_ID || profile.clientId || DEFAULT_CLIENT_ID,
    clientSecret: options.clientSecret || context.env.LEARN_DEROSE_CLIENT_SECRET || profile.clientSecret
  };

  return {
    config,
    profile: updatedProfile
  };
}

async function createContext(options, deps) {
  const env = deps.env || process.env;
  const profileName = options.profile || env.LEARN_DEROSE_PROFILE || "default";
  const store = new ConfigStore(options.config || defaultConfigPath(env));
  const stderr = deps.stderr || process.stderr;
  const logger = createLogger({
    enabled: debugEnabled(options, env),
    stderr
  });

  return {
    env,
    fetch: deps.fetch || globalThis.fetch,
    now: deps.now || (() => new Date()),
    stdout: deps.stdout || process.stdout,
    stderr,
    logger,
    profileName,
    store
  };
}

function parseArgs(argv) {
  const options = {};
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const equalsIndex = arg.indexOf("=");
    const rawKey = equalsIndex === -1 ? arg.slice(2) : arg.slice(2, equalsIndex);
    const inlineValue = equalsIndex === -1 ? undefined : arg.slice(equalsIndex + 1);
    const key = camelize(rawKey);

    if (BOOLEAN_FLAGS.has(key)) {
      options[key] = inlineValue === undefined ? true : inlineValue !== "false";
      continue;
    }

    const nextValue = inlineValue === undefined ? argv[index + 1] : inlineValue;

    if (nextValue === undefined || nextValue.startsWith("--")) {
      throw new CliError(`Missing value for --${rawKey}`);
    }

    options[key] = nextValue;
    if (inlineValue === undefined) index += 1;
  }

  return { options, positionals };
}

function isHelpCommand(positionals) {
  return positionals.length === 1 && positionals[0] === "help";
}

function camelize(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function requireOption(options, key, flagName) {
  if (options[key] === undefined || options[key] === "") {
    throw new CliError(`Missing required option ${flagName}.`);
  }
}

function requireArgument(value, name) {
  if (!value) throw new CliError(`Missing ${name}.`);
}

function writePayload(stdout, payload, { json, formatter }) {
  if (json) {
    stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    stdout.write(formatter(payload));
  }
}

function formatStatus(payload) {
  const lines = [
    `Profile: ${payload.profile}`,
    `Issuer: ${payload.issuer}`,
    `API: ${payload.apiBaseUrl}`,
    `Client ID: ${payload.clientId || ""}`,
    `Scope: ${payload.scope || ""}`,
    `Authenticated: ${payload.authenticated ? "yes" : "no"}`,
    `Expires at: ${payload.expiresAt || ""}`
  ];

  return `${lines.join("\n")}\n`;
}

function helpText() {
  return `learn-derose

Authenticate with Learn OAuth and manage bookings through the public API.

Usage:
  learn-derose auth login
  learn-derose auth status [--json]
  learn-derose auth logout [--revoke]
  learn-derose classes list [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--account-id ID] [--teacher-id ID] [--presence-type online|in_person] [--requires-booking] [--json]
  learn-derose bookings list [--state active|history|all] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--json]
  learn-derose bookings show BOOKING_ID [--json]
  learn-derose bookings create --post-id POST_ID --date YYYY-MM-DD [--waitlist] [--json]
  learn-derose bookings cancel BOOKING_ID [--json]

Global options:
  --config PATH              Config file path. Defaults to $XDG_CONFIG_HOME/learn-derose/config.json.
  --profile NAME             Profile name. Defaults to default.
  --locale LOCALE            Sends X-Locale with API requests.
  --json                     Print machine-readable JSON.
  --verbose                  Print diagnostic logs to stderr.
  --debug                    Alias for --verbose.
`;
}
