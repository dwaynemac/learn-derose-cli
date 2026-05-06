import { CliError } from "./errors.mjs";
import { refreshAccessToken } from "./oauth.mjs";

const REFRESH_SKEW_MS = 60 * 1000;

export function createAccessTokenProvider({
  profile,
  saveProfile,
  now = () => new Date(),
  fetch: fetchImpl = globalThis.fetch,
  logger = null
}) {
  return async function getAccessToken() {
    if (!profile?.token?.accessToken) {
      throw new CliError("No OAuth access token found. Run `learn-derose auth login` first.");
    }

    if (!tokenNeedsRefresh(profile.token, now())) {
      return profile.token.accessToken;
    }

    if (!profile.token.refreshToken) {
      throw new CliError("OAuth access token expired and no refresh token is available. Run `learn-derose auth login` again.");
    }

    const payload = await refreshAccessToken({
      issuer: profile.issuer,
      clientId: profile.clientId,
      clientSecret: profile.clientSecret,
      refreshToken: profile.token.refreshToken,
      fetch: fetchImpl,
      logger
    });

    profile.token = tokenFromResponse(payload, {
      previousToken: profile.token,
      now
    });

    await saveProfile(profile);
    return profile.token.accessToken;
  };
}

export function tokenFromResponse(payload, { previousToken = {}, now = () => new Date() } = {}) {
  if (!payload.access_token) {
    throw new CliError("OAuth token response did not include an access token.");
  }

  const expiresAt = payload.expires_in
    ? new Date(now().getTime() + Number(payload.expires_in) * 1000).toISOString()
    : previousToken.expiresAt;

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || previousToken.refreshToken,
    idToken: payload.id_token || previousToken.idToken,
    tokenType: payload.token_type || previousToken.tokenType || "Bearer",
    expiresAt,
    scope: payload.scope || previousToken.scope
  };
}

function tokenNeedsRefresh(token, now) {
  if (!token.expiresAt) return false;
  return new Date(token.expiresAt).getTime() <= now.getTime() + REFRESH_SKEW_MS;
}
