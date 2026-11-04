import "dotenv/config";
import { closePool } from "./db.js";
import { createApp } from "./app.js";

const app = createApp();
const port = Number(process.env.API_PORT ?? 4000);
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`ORCA API listening on ${port}`);
});

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`ORCA API received ${signal}; shutting down gracefully`);
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
