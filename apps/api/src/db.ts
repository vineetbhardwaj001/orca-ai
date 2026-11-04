import pg from "pg";
import { loadApiConfig } from "./config.js";

const { Pool } = pg;
let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!pool) {
    const config = loadApiConfig();
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: config.dbPoolMax,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      ssl: config.databaseSsl ? { rejectUnauthorized: true } : undefined,
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    const current = pool;
    pool = undefined;
    await current.end();
  }
}
