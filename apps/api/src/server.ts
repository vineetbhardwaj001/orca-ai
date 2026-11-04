import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { closePool } from "./db.js";
import { createApp } from "./app.js";
import { loadApiConfig } from "./config.js";

// Resolve the repository-root .env file from the API entry point, regardless
// of whether the command was launched by pnpm, Turbo or the compiled server.
dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const config = loadApiConfig();
const app = createApp();
const server = app.listen(config.apiPort, "0.0.0.0", () => {
  console.log(JSON.stringify({
    level: "info",
    event: "api_started",
    port: config.apiPort,
    environment: config.nodeEnv,
  }));
});

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(JSON.stringify({ level: "info", event: "api_shutdown", signal }));
  server.close(async (error) => {
    try {
      await closePool();
      process.exit(error ? 1 : 0);
    } catch {
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
