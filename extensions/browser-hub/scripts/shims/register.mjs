import { register } from "node:module";
register("./resolve-hook.mjs", import.meta.url);

// logError is a GJS ambient global (injected by the Shell's JS environment,
// like log/print) — src/ code calls it as a bare identifier assuming it
// always exists. Under plain Node it doesn't, so resolver rejections would
// crash this dev script with a ReferenceError instead of being logged.
globalThis.logError = (exception, message) => {
  if (message) console.error(message);
  console.error(exception);
};
