#!/usr/bin/env node

/**
 * Compatibility entry point for the former Nexilume CLI path.
 *
 * New integrations should execute `axirune` or import from `./axirune.js`.
 */
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "./axirune.js";

export { runCli, type CliEnvironment } from "./axirune.js";

const executedPath = process.argv[1] ? realpathSync(resolve(process.argv[1])) : "";
if (fileURLToPath(import.meta.url) === executedPath) {
  process.exitCode = await runCli(process.argv.slice(2));
}
