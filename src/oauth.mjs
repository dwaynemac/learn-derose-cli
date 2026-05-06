import crypto from "node:crypto";

import { ApiError } from "./errors.mjs";

export const DEFAULT_ISSUER = "https://learn.derose.app";
export const DEFAULT_API_BASE_URL = `${DEFAULT_ISSUER}/api/v1`;
export const DEFAULT_CLIENT_ID = "xqerTj2buGDRMTf03q-QO2E6F7su-WrAESCHnK7BsxM";
export const DEFAULT_REDIRECT_URI = "http://localhost:8787/callback";
export const DEFAULT_SCOPE = "openid email profile bookings:read bookings:write";

export function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/+$/, "");
}

export function oauthEndpoint(issuer, path) {
  return `${normalizeBaseUrl(issuer)}${path}`;
}

export function base64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function createCodeVerifier(randomBytes = crypto.randomBytes) {
  return base64Url(randomBytes(32));
}

export async function createCodeChallenge(codeVerifier) {
  return base64Url(crypto.createHash("sha256").update(codeVerifier).digest());
}

export function createState(randomBytes = crypto.randomBytes) {
  return base64Url(randomBytes(24));
}

export async function createPkcePair() {
  const codeVerifier = createCodeVerifier();
  const codeChallenge = await createCodeChallenge(codeVerifier);
  return { codeVerifier, codeChallenge };
}

export function buildAuthorizationUrl({
  issuer = DEFAULT_ISSUER,
  clientId = DEFAULT_CLIENT_ID,
  redirectUri = DEFAULT_REDIRECT_URI,
  scope = DEFAULT_SCOPE,
  state,
  codeChallenge
}) {
  const url = new URL(oauthEndpoint(issuer, "/oauth/authorize"));
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function exchangeAuthorizationCode({
  issuer = DEFAULT_ISSUER,
  clientId,
  clientSecret,
  code,
  redirectUri = DEFAULT_REDIRECT_URI,
  codeVerifier,
  fetch: fetchImpl = globalThis.fetch,
  logger = null
}) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier
  });

  if (clientSecret) body.set("client_secret", clientSecret);

  return postOAuthToken({
    issuer,
    body,
    fetch: fetchImpl,
    logger
  });
}

export async function refreshAccessToken({
  issuer = DEFAULT_ISSUER,
  clientId,
  clientSecret,
  refreshToken,
  fetch: fetchImpl = globalThis.fetch,
  logger = null
}) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId
  });

  if (clientSecret) body.set("client_secret", clientSecret);

  return postOAuthToken({
    issuer,
    body,
    fetch: fetchImpl,
    logger
  });
}

export async function revokeToken({
  issuer = DEFAULT_ISSUER,
  clientId,
  clientSecret,
  token,
  fetch: fetchImpl = globalThis.fetch,
  logger = null
}) {
  const body = new URLSearchParams({
    token,
    client_id: clientId
  });

  if (clientSecret) body.set("client_secret", clientSecret);

  const url = oauthEndpoint(issuer, "/oauth/revoke");
  logger?.debug(`OAuth revoke request POST ${url}`);

  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });
  } catch (error) {
    throw fetchFailureError({
      error,
      label: "Learn OAuth revoke endpoint",
      method: "POST",
      url
    });
  }

  logger?.debug(`OAuth revoke response POST ${url} -> ${response.status}`);

  if (!response.ok) {
    throw await responseError(response, "OAuth token revocation failed");
  }
}

async function postOAuthToken({ issuer, body, fetch: fetchImpl, logger }) {
  const url = oauthEndpoint(issuer, "/oauth/token");
  logger?.debug(`OAuth token request POST ${url}`);

  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });
  } catch (error) {
    throw fetchFailureError({
      error,
      label: "Learn OAuth token endpoint",
      method: "POST",
      url
    });
  }

  logger?.debug(`OAuth token response POST ${url} -> ${response.status}`);

  if (!response.ok) {
    throw await responseError(response, "OAuth token request failed");
  }

  return response.json();
}

export function fetchFailureError({ error, label, method, url }) {
  const causeMessage = error.cause?.message || error.message || "unknown error";
  const causeCode = error.cause?.code || error.code;
  const codeText = causeCode ? ` (${causeCode})` : "";
  const hint = certificateError(causeCode, causeMessage)
    ? " If this is a local mkcert domain, set NODE_EXTRA_CA_CERTS to the mkcert root CA, for example `NODE_EXTRA_CA_CERTS=\"$(mkcert -CAROOT)/rootCA.pem\"`."
    : " Check the issuer/API URL, network access, and whether the local server is running.";

  return new ApiError(
    `Could not reach ${label} at ${url} while sending ${method}: ${causeMessage}${codeText}.${hint}`,
    {
      cause: error
    }
  );
}

function certificateError(code, message) {
  return [
    "DEPTH_ZERO_SELF_SIGNED_CERT",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    "CERT_HAS_EXPIRED"
  ].includes(code) || /certificate|cert/i.test(message);
}

async function responseError(response, fallbackMessage) {
  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  const message = payload?.error_description || payload?.message || payload?.error || text || fallbackMessage;
  return new ApiError(`${fallbackMessage} (${response.status}): ${message}`, {
    status: response.status,
    payload
  });
}
