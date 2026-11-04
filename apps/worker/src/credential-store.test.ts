import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadWorkerCredential, saveWorkerCredential } from "./credential-store.js";

const credential = {
  apiBaseUrl: "http://127.0.0.1:4000",
  workerId: "f8a7e1b9-7146-4d8f-8d17-c9db2ffeb3af",
  credential: "x".repeat(43),
  createdAt: "2026-11-04T15:00:00.000Z",
};

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("worker credential file", () => {
  it("writes a credential once and reads back the same worker identity", async () => {
    const directory = await mkdtemp(join(tmpdir(), "orca-worker-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "worker-credential.json");

    await saveWorkerCredential(path, credential);
    const loaded = await loadWorkerCredential(path);

    expect(loaded).toEqual(credential);
    const raw = await readFile(path, "utf8");
    expect(raw).toContain(credential.workerId);
    expect(raw).toContain(credential.credential);
    if (process.platform !== "win32") {
      expect((await stat(path)).mode & 0o777).toBe(0o600);
    }
  });

  it("refuses to overwrite an existing credential file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "orca-worker-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "worker-credential.json");

    await saveWorkerCredential(path, credential);
    await expect(saveWorkerCredential(path, credential)).rejects.toThrow(/already exists/);
  });

  it("rejects non-HTTPS remote APIs and API URLs with embedded credentials", async () => {
    const directory = await mkdtemp(join(tmpdir(), "orca-worker-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "worker-credential.json");

    await expect(saveWorkerCredential(path, {
      ...credential,
      apiBaseUrl: "http://api.example.test",
    })).rejects.toThrow(/HTTPS/);

    await expect(saveWorkerCredential(path, {
      ...credential,
      apiBaseUrl: "https://user:password@api.example.test",
    })).rejects.toThrow(/clean origin/);
    expect(await readdir(directory)).toEqual([]);
  });
});
