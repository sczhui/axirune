import { createServer, type Server } from "node:http";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createHostAdapters,
  HOST_CAPABILITIES,
} from "../../src/cli/host-adapters.js";
import type {
  RuntimeValue,
  ToolCallRequest,
  ToolDefinition,
} from "../../src/language/index.js";

describe("CLI host adapters", () => {
  let directory = "";
  let readable = "";
  let writable = "";
  let outside = "";
  let server: Server | undefined;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "axirune-host-"));
    readable = join(directory, "readable");
    writable = join(directory, "writable");
    outside = join(directory, "outside");
    await Promise.all([
      mkdir(readable),
      mkdir(writable),
      mkdir(outside),
    ]);
    await writeFile(join(readable, "message.txt"), "deterministic input", "utf8");
    await writeFile(join(outside, "secret.txt"), "outside", "utf8");
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => (error ? reject(error) : resolve())),
      );
      server = undefined;
    }
    await rm(directory, { recursive: true, force: true });
  });

  it("reads, lists and checks files only below an allowed root", async () => {
    const adapters = await createHostAdapters({
      cwd: directory,
      readRoots: [readable],
    });
    expect(adapters.capabilities).toEqual([HOST_CAPABILITIES.fileRead]);
    expect(
      await call(adapters.tools["File.readText"]!, {
        path: join(readable, "message.txt"),
      }),
    ).toBe("deterministic input");
    expect(
      await call(adapters.tools["File.exists"]!, {
        path: join(readable, "missing.txt"),
      }),
    ).toBe(false);
    expect(await call(adapters.tools["File.list"]!, { path: readable })).toEqual([
      "message.txt",
    ]);
    await expect(
      call(adapters.tools["File.readText"]!, {
        path: join(outside, "secret.txt"),
      }),
    ).rejects.toThrow(/escapes every authorized root/u);
  });

  it("rejects a symlink that resolves outside the readable root", async () => {
    await symlink(join(outside, "secret.txt"), join(readable, "escape.txt"));
    const adapters = await createHostAdapters({
      cwd: directory,
      readRoots: [readable],
    });
    await expect(
      call(adapters.tools["File.readText"]!, {
        path: join(readable, "escape.txt"),
      }),
    ).rejects.toThrow(/resolves outside every authorized root/u);
  });

  it("writes only below an explicitly writable root", async () => {
    const adapters = await createHostAdapters({
      cwd: directory,
      writeRoots: [writable],
    });
    expect(adapters.capabilities).toEqual([HOST_CAPABILITIES.fileWrite]);
    const target = join(writable, "result.txt");
    await expect(
      call(adapters.tools["File.writeText"]!, {
        path: target,
        text: "bounded output",
      }),
    ).resolves.toMatchObject({ bytes: 14 });
    expect(await readFile(target, "utf8")).toBe("bounded output");

    await expect(
      call(adapters.tools["File.writeText"]!, {
        path: join(outside, "denied.txt"),
        text: "no",
      }),
    ).rejects.toThrow(/escapes every authorized root/u);
  });

  it("does not follow a writable-root symlink to an outside file", async () => {
    const secret = join(outside, "secret.txt");
    const link = join(writable, "escape.txt");
    await symlink(secret, link);
    const adapters = await createHostAdapters({
      cwd: directory,
      writeRoots: [writable],
    });
    await expect(
      call(adapters.tools["File.writeText"]!, {
        path: link,
        text: "overwrite",
      }),
    ).rejects.toThrow(/resolves outside every authorized root/u);
    expect(await readFile(secret, "utf8")).toBe("outside");
  });

  it("fails closed when no filesystem root was granted", async () => {
    const adapters = await createHostAdapters({ cwd: directory });
    await expect(
      call(adapters.tools["File.readText"]!, {
        path: join(readable, "message.txt"),
      }),
    ).rejects.toThrow(/does not allow filesystem read/u);
  });

  it("bounds host file payloads", async () => {
    const adapters = await createHostAdapters({
      cwd: directory,
      readRoots: [readable],
      writeRoots: [writable],
      maxFileBytes: 4,
    });
    await expect(
      call(adapters.tools["File.readText"]!, {
        path: join(readable, "message.txt"),
      }),
    ).rejects.toThrow(/exceeds 4 bytes/u);
    await expect(
      call(adapters.tools["File.writeText"]!, {
        path: join(writable, "large.txt"),
        text: "12345",
      }),
    ).rejects.toThrow(/exceeds 4 bytes/u);
  });

  it("allows an exact local host and checks every redirect", async () => {
    server = createServer((request, response) => {
      if (request.url === "/redirect-ok") {
        response.writeHead(302, { location: "/ok" });
        response.end();
        return;
      }
      if (request.url === "/redirect-escape") {
        const address = server!.address();
        const port = typeof address === "object" && address ? address.port : 0;
        response.writeHead(302, { location: `http://localhost:${port}/ok` });
        response.end();
        return;
      }
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("local response");
    });
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const host = `127.0.0.1:${port}`;
    const adapters = await createHostAdapters({
      cwd: directory,
      networkHosts: [host],
    });
    expect(adapters.capabilities).toEqual([HOST_CAPABILITIES.networkFetch]);
    await expect(
      call(adapters.tools["Http.get"]!, {
        url: `http://${host}/redirect-ok`,
      }),
    ).resolves.toMatchObject({
      status: 200,
      body: "local response",
    });
    await expect(
      call(adapters.tools["Http.get"]!, {
        url: `http://${host}/redirect-escape`,
      }),
    ).rejects.toThrow(/host is not authorized: localhost/u);
  });
});

async function call(
  definition: ToolDefinition,
  namedArguments: Readonly<Record<string, RuntimeValue>>,
): Promise<RuntimeValue> {
  const request: ToolCallRequest = {
    name: "test",
    arguments: [],
    namedArguments,
    capabilities: [],
    frame: null,
  };
  return await definition.run(request);
}
