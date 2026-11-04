import { chmod, mkdir, open, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";

const credentialSchema = z.object({
  apiBaseUrl: z.string().url(),
  workerId: z.string().uuid(),
  credential: z.string().regex(/^[A-Za-z0-9_-]{40,128}$/),
  createdAt: z.string().datetime(),
});
export type WorkerCredential = z.infer<typeof credentialSchema>;

function validateApiBaseUrl(value: string): void {
  const url = new URL(value);
  if (url.origin !== value || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("Worker API base URL must be a clean origin without credentials, path, query or fragment.");
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("Worker credential files may only target HTTPS APIs, except loopback development.");
  }
}

export async function loadWorkerCredential(path: string): Promise<WorkerCredential> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, "utf8"));
  } catch {
    throw new Error("Worker credential file could not be read or parsed.");
  }
  const parsed = credentialSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Worker credential file is malformed; re-enroll this worker.");
  validateApiBaseUrl(parsed.data.apiBaseUrl);
  return parsed.data;
}

export async function saveWorkerCredential(path: string, credential: WorkerCredential): Promise<void> {
  const parsed = credentialSchema.parse(credential);
  validateApiBaseUrl(parsed.apiBaseUrl);

  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  let handle;
  try {
    // wx prevents accidental overwrite and prevents a credential rotation race
    // from silently replacing a file that the operator has not inspected.
    handle = await open(path, "wx", 0o600);
    await handle.writeFile(JSON.stringify(parsed, null, 2) + "\n", "utf8");
    await handle.sync();
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST") {
      throw new Error("Worker credential file already exists. Remove or move it only after verifying the worker's state.");
    }
    throw error;
  } finally {
    await handle?.close();
  }

  // Enforce restrictive POSIX permissions. On Windows, protect the file using
  // the worker account's profile-directory ACL; chmod cannot tighten NTFS ACLs.
  if (process.platform !== "win32") await chmod(path, 0o600);
}
