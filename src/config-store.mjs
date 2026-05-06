import os from "node:os";
import path from "node:path";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";

export function defaultConfigPath(env = process.env) {
  if (env.LEARN_DEROSE_CONFIG) return env.LEARN_DEROSE_CONFIG;

  const home = env.HOME || os.homedir();
  const configHome = env.XDG_CONFIG_HOME || path.join(home, ".config");
  return path.join(configHome, "learn-derose", "config.json");
}

export class ConfigStore {
  constructor(filePath = defaultConfigPath()) {
    this.filePath = filePath;
  }

  async load() {
    try {
      const content = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(content);
      return {
        activeProfile: parsed.activeProfile || "default",
        profiles: parsed.profiles || {}
      };
    } catch (error) {
      if (error.code === "ENOENT") return emptyConfig();
      throw error;
    }
  }

  async save(config) {
    await mkdir(path.dirname(this.filePath), { recursive: true });

    const payload = JSON.stringify(
      {
        activeProfile: config.activeProfile || "default",
        profiles: config.profiles || {}
      },
      null,
      2
    );
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;

    await writeFile(temporaryPath, `${payload}\n`, { mode: 0o600 });
    await chmod(temporaryPath, 0o600);
    await rename(temporaryPath, this.filePath);
    await chmod(this.filePath, 0o600);
  }
}

export function emptyConfig() {
  return {
    activeProfile: "default",
    profiles: {}
  };
}
