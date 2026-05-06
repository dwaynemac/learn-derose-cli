import { spawn } from "node:child_process";

export function openUrl(url, { platform = process.platform } = {}) {
  const command = commandForPlatform(platform, url);
  if (!command) return false;

  const child = spawn(command.command, command.args, {
    detached: true,
    stdio: "ignore"
  });

  child.on("error", () => {});
  child.unref();
  return true;
}

function commandForPlatform(platform, url) {
  if (platform === "darwin") return { command: "open", args: [url] };
  if (platform === "win32") return { command: "cmd", args: ["/c", "start", "", url] };
  return { command: "xdg-open", args: [url] };
}
