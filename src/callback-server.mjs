import http from "node:http";

import { CliError } from "./errors.mjs";

export async function waitForAuthorizationCode({ redirectUri, state, timeoutMs = 300000 }) {
  const callbackUrl = new URL(redirectUri);

  if (callbackUrl.protocol !== "http:" || !isLoopbackHost(callbackUrl.hostname)) {
    throw new CliError("The CLI callback server only supports local loopback http redirect URIs.");
  }

  const port = Number(callbackUrl.port || 80);
  const host = callbackUrl.hostname;

  return new Promise((resolve, reject) => {
    let settled = false;

    const server = http.createServer((request, response) => {
      const requestUrl = new URL(request.url, redirectUri);

      if (requestUrl.pathname !== callbackUrl.pathname) {
        response.writeHead(404, { "Content-Type": "text/plain" });
        response.end("Not found");
        return;
      }

      const receivedState = requestUrl.searchParams.get("state");
      const code = requestUrl.searchParams.get("code");
      const error = requestUrl.searchParams.get("error");

      if (error) {
        finish(new CliError(`Learn OAuth authorization failed: ${error}`), null, response);
        return;
      }

      if (!code) {
        finish(new CliError("Learn OAuth callback did not include an authorization code."), null, response);
        return;
      }

      if (receivedState !== state) {
        finish(new CliError("Learn OAuth callback state did not match the login request."), null, response);
        return;
      }

      finish(null, code, response);
    });

    const timer = setTimeout(() => {
      finish(new CliError("Timed out waiting for Learn OAuth authorization."), null);
    }, timeoutMs);

    server.on("error", (error) => {
      clearTimeout(timer);
      reject(new CliError(`Could not start OAuth callback server on ${redirectUri}: ${error.message}`));
    });

    server.listen(port, host);

    function finish(error, code, response) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (response) {
        response.writeHead(error ? 400 : 200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(error ? failurePage(error.message) : successPage());
      }

      server.close(() => {
        if (error) reject(error);
        else resolve(code);
      });
    }
  });
}

function isLoopbackHost(hostname) {
  const normalized = hostname.replace(/^\[(.*)\]$/, "$1").toLowerCase();
  return normalized === "localhost" || normalized === "::1" || /^127(?:\.\d{1,3}){3}$/.test(normalized);
}

function successPage() {
  return "<!doctype html><title>Learn OAuth</title><p>Authentication complete. You can return to the terminal.</p>";
}

function failurePage(message) {
  return `<!doctype html><title>Learn OAuth</title><p>Authentication failed: ${escapeHtml(message)}</p>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
