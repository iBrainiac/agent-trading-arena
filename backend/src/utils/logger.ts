const ts = () => new Date().toISOString();

export const logger = {
  info: (msg: string, data?: unknown) =>
    console.log(`[${ts()}] INFO  ${msg}`, data !== undefined ? data : ''),
  warn: (msg: string, data?: unknown) =>
    console.warn(`[${ts()}] WARN  ${msg}`, data !== undefined ? data : ''),
  error: (msg: string, data?: unknown) =>
    console.error(`[${ts()}] ERROR ${msg}`, data !== undefined ? data : ''),
};
