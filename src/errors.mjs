export class CliError extends Error {
  constructor(message, { exitCode = 1 } = {}) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

export class ApiError extends Error {
  constructor(message, { status, payload, cause } = {}) {
    super(message, { cause });
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}
