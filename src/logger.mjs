export function createLogger({ enabled = false, stderr = process.stderr } = {}) {
  return {
    enabled,
    debug(message) {
      if (!enabled) return;
      stderr.write(`[learn-derose] ${message}\n`);
    }
  };
}

export function debugEnabled(options = {}, env = process.env) {
  return Boolean(
    options.verbose ||
    options.debug ||
    env.LEARN_DEROSE_DEBUG === "1" ||
    env.LEARN_DEROSE_DEBUG === "true"
  );
}
