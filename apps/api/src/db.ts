import pg from "pg";

const { Pool } = pg;
let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is required");
    pool = new Pool({
      connectionString,
      max: Number(process.env.DB_POOL_MAX ?? 10),
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
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
