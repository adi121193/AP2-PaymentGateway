/**
 * Logger for agent runtime
 * Re-exports from domain logger or creates simple console logger
 */

export const logger = {
  info: (obj: any, msg?: string) => {
    console.log(JSON.stringify({ level: "info", ...obj, msg }));
  },
  warn: (obj: any, msg?: string) => {
    console.warn(JSON.stringify({ level: "warn", ...obj, msg }));
  },
  error: (obj: any, msg?: string) => {
    console.error(JSON.stringify({ level: "error", ...obj, msg }));
  },
  debug: (obj: any, msg?: string) => {
    console.debug(JSON.stringify({ level: "debug", ...obj, msg }));
  },
};
