import { constants } from "node:fs";
import {
  open,
  opendir,
  realpath,
  stat,
} from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
} from "node:path";
import type {
  RuntimeValue,
  ToolCallRequest,
  ToolDefinition,
} from "../language/index.js";

export const HOST_CAPABILITIES = {
  fileRead: "host.fs.read",
  fileWrite: "host.fs.write",
  networkFetch: "host.net.fetch",
} as const;

export interface HostAdapterOptions {
  cwd: string;
  readRoots?: readonly string[];
  writeRoots?: readonly string[];
  networkHosts?: readonly string[];
  maxResponseBytes?: number;
  maxFileBytes?: number;
  maxDirectoryEntries?: number;
  fetchImplementation?: typeof fetch;
}

export interface HostAdapterSet {
  tools: Readonly<Record<string, ToolDefinition>>;
  capabilities: readonly string[];
  authority: {
    readRoots: readonly string[];
    writeRoots: readonly string[];
    networkHosts: readonly string[];
  };
}

interface AuthorizedRoot {
  requested: string;
  canonical: string;
}

const DEFAULT_MAX_RESPONSE_BYTES = 1_048_576;
const DEFAULT_MAX_FILE_BYTES = 1_048_576;
const DEFAULT_MAX_DIRECTORY_ENTRIES = 10_000;
const MAX_REDIRECTS = 5;

export async function createHostAdapters(
  options: HostAdapterOptions,
): Promise<HostAdapterSet> {
  const cwd = resolve(options.cwd);
  const readRoots = await normalizeRoots(options.readRoots ?? [], cwd, "--allow-read");
  const writeRoots = await normalizeRoots(options.writeRoots ?? [], cwd, "--allow-write");
  const networkHosts = unique(
    (options.networkHosts ?? []).map((host) => normalizeAllowedHost(host)),
  );
  const capabilities = [
    ...(readRoots.length > 0 ? [HOST_CAPABILITIES.fileRead] : []),
    ...(writeRoots.length > 0 ? [HOST_CAPABILITIES.fileWrite] : []),
    ...(networkHosts.length > 0 ? [HOST_CAPABILITIES.networkFetch] : []),
  ];
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const maxDirectoryEntries =
    options.maxDirectoryEntries ?? DEFAULT_MAX_DIRECTORY_ENTRIES;
  validatePositiveLimit(maxResponseBytes, "maxResponseBytes");
  validatePositiveLimit(maxFileBytes, "maxFileBytes");
  validatePositiveLimit(maxDirectoryEntries, "maxDirectoryEntries");

  const tools: Record<string, ToolDefinition> = {
    "File.readText": {
      capabilities: [HOST_CAPABILITIES.fileRead],
      run: async (request) => {
        const path = stringArgument(request, "path", 0);
        const target = await authorizeExistingPath(path, cwd, readRoots, "read");
        return await readUtf8(target, maxFileBytes);
      },
    },
    "File.writeText": {
      capabilities: [HOST_CAPABILITIES.fileWrite],
      run: async (request) => {
        const path = stringArgument(request, "path", 0);
        const text = stringArgument(request, "text", 1);
        if (Buffer.byteLength(text, "utf8") > maxFileBytes) {
          throw new HostAdapterError(
            `File.writeText input exceeds ${maxFileBytes} bytes.`,
          );
        }
        const target = await authorizeWritePath(path, cwd, writeRoots);
        await writeUtf8NoFollow(target, text);
        return { path, bytes: Buffer.byteLength(text, "utf8") };
      },
    },
    "File.exists": {
      capabilities: [HOST_CAPABILITIES.fileRead],
      run: async (request) => {
        const path = stringArgument(request, "path", 0);
        return await authorizedPathExists(path, cwd, readRoots);
      },
    },
    "File.list": {
      capabilities: [HOST_CAPABILITIES.fileRead],
      run: async (request) => {
        const path = stringArgument(request, "path", 0);
        const target = await authorizeExistingPath(path, cwd, readRoots, "list");
        const metadata = await stat(target);
        if (!metadata.isDirectory()) {
          throw new HostAdapterError(`File.list requires a directory: ${path}`);
        }
        return await listDirectory(target, maxDirectoryEntries);
      },
    },
    "Http.get": {
      capabilities: [HOST_CAPABILITIES.networkFetch],
      run: async (request) => {
        const url = stringArgument(request, "url", 0);
        return await httpGetWithPolicy(url, {
          allowedHosts: networkHosts,
          fetchImplementation,
          maxResponseBytes,
          signal: request.signal,
        });
      },
    },
  };

  return {
    tools,
    capabilities,
    authority: {
      readRoots: readRoots.map((root) => root.canonical),
      writeRoots: writeRoots.map((root) => root.canonical),
      networkHosts,
    },
  };
}

export class HostAdapterError extends Error {
  readonly name = "HostAdapterError";
}

interface HttpPolicy {
  allowedHosts: readonly string[];
  fetchImplementation: typeof fetch;
  maxResponseBytes: number;
  signal?: AbortSignal;
}

export async function httpGetWithPolicy(
  input: string,
  policy: HttpPolicy,
): Promise<RuntimeValue> {
  let current = parseHttpUrl(input);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    authorizeHost(current, policy.allowedHosts);
    const response = await policy.fetchImplementation(current, {
      method: "GET",
      redirect: "manual",
      ...(policy.signal ? { signal: policy.signal } : {}),
    });
    const location = response.headers.get("location");
    if (isRedirect(response.status) && location) {
      await response.body?.cancel();
      if (redirect === MAX_REDIRECTS) {
        throw new HostAdapterError(`Http.get exceeded ${MAX_REDIRECTS} redirects.`);
      }
      current = parseHttpUrl(new URL(location, current).href);
      continue;
    }
    const body = await readResponseBody(response, policy.maxResponseBytes);
    return {
      status: response.status,
      url: current.href,
      headers: Object.fromEntries(response.headers.entries()),
      body,
    };
  }
  throw new HostAdapterError("Http.get redirect processing failed.");
}

async function normalizeRoots(
  roots: readonly string[],
  cwd: string,
  option: string,
): Promise<AuthorizedRoot[]> {
  const normalized: AuthorizedRoot[] = [];
  for (const value of roots) {
    const requested = resolve(cwd, value);
    let canonical: string;
    try {
      canonical = await realpath(requested);
    } catch {
      throw new HostAdapterError(`${option} root does not exist: ${value}`);
    }
    if (!(await stat(canonical)).isDirectory()) {
      throw new HostAdapterError(`${option} root is not a directory: ${value}`);
    }
    if (!normalized.some((root) => root.canonical === canonical)) {
      normalized.push({ requested, canonical });
    }
  }
  return normalized;
}

async function authorizeExistingPath(
  value: string,
  cwd: string,
  roots: readonly AuthorizedRoot[],
  action: string,
): Promise<string> {
  requireRoots(roots, action);
  const candidate = resolve(cwd, value);
  requireLexicalContainment(candidate, roots, action);
  let canonical: string;
  try {
    canonical = await realpath(candidate);
  } catch {
    throw new HostAdapterError(`Cannot ${action} missing path: ${value}`);
  }
  requireCanonicalContainment(canonical, roots, action);
  return canonical;
}

async function authorizedPathExists(
  value: string,
  cwd: string,
  roots: readonly AuthorizedRoot[],
): Promise<boolean> {
  requireRoots(roots, "inspect");
  const candidate = resolve(cwd, value);
  requireLexicalContainment(candidate, roots, "inspect");
  try {
    const canonical = await realpath(candidate);
    requireCanonicalContainment(canonical, roots, "inspect");
    return true;
  } catch (error) {
    if (!isMissingPathError(error)) throw error;
    const ancestor = await nearestExistingAncestor(candidate);
    requireCanonicalContainment(ancestor, roots, "inspect");
    return false;
  }
}

async function authorizeWritePath(
  value: string,
  cwd: string,
  roots: readonly AuthorizedRoot[],
): Promise<string> {
  requireRoots(roots, "write");
  const candidate = resolve(cwd, value);
  requireLexicalContainment(candidate, roots, "write");
  try {
    const canonical = await realpath(candidate);
    requireCanonicalContainment(canonical, roots, "write");
    return canonical;
  } catch (error) {
    if (!isMissingPathError(error)) throw error;
    let canonicalParent: string;
    try {
      canonicalParent = await realpath(dirname(candidate));
    } catch {
      throw new HostAdapterError(`File.writeText parent directory does not exist: ${value}`);
    }
    requireCanonicalContainment(canonicalParent, roots, "write");
    return resolve(canonicalParent, basename(candidate));
  }
}

async function nearestExistingAncestor(candidate: string): Promise<string> {
  let current = candidate;
  for (;;) {
    try {
      return await realpath(current);
    } catch (error) {
      if (!isMissingPathError(error)) throw error;
      const parent = dirname(current);
      if (parent === current) throw error;
      current = parent;
    }
  }
}

function requireRoots(roots: readonly AuthorizedRoot[], action: string): void {
  if (roots.length === 0) {
    throw new HostAdapterError(`Host authority does not allow filesystem ${action}.`);
  }
}

function requireLexicalContainment(
  candidate: string,
  roots: readonly AuthorizedRoot[],
  action: string,
): void {
  if (
    !roots.some(
      (root) =>
        containsPath(root.requested, candidate) ||
        containsPath(root.canonical, candidate),
    )
  ) {
    throw new HostAdapterError(`Filesystem ${action} escapes every authorized root.`);
  }
}

function requireCanonicalContainment(
  candidate: string,
  roots: readonly AuthorizedRoot[],
  action: string,
): void {
  if (!roots.some((root) => containsPath(root.canonical, candidate))) {
    throw new HostAdapterError(
      `Filesystem ${action} resolves outside every authorized root.`,
    );
  }
}

function containsPath(root: string, candidate: string): boolean {
  const child = relative(root, candidate);
  return child === "" || (!child.startsWith("..") && !isAbsolute(child));
}

async function readUtf8(path: string, limit: number): Promise<string> {
  const handle = await open(path, constants.O_RDONLY | noFollowFlag());
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile()) {
      throw new HostAdapterError("File.readText requires a regular file.");
    }
    if (metadata.size > limit) {
      throw new HostAdapterError(`File.readText input exceeds ${limit} bytes.`);
    }
    const chunks: Buffer[] = [];
    let total = 0;
    for (;;) {
      const chunk = Buffer.allocUnsafe(Math.min(65_536, limit + 1 - total));
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
      if (bytesRead === 0) break;
      total += bytesRead;
      if (total > limit) {
        throw new HostAdapterError(`File.readText input exceeds ${limit} bytes.`);
      }
      chunks.push(chunk.subarray(0, bytesRead));
    }
    return Buffer.concat(chunks, total).toString("utf8");
  } finally {
    await handle.close();
  }
}

async function listDirectory(path: string, limit: number): Promise<string[]> {
  const directory = await opendir(path);
  const names: string[] = [];
  try {
    for await (const entry of directory) {
      names.push(entry.name);
      if (names.length > limit) {
        throw new HostAdapterError(`File.list exceeds ${limit} entries.`);
      }
    }
  } finally {
    await directory.close().catch(() => undefined);
  }
  return names.sort((left, right) => left.localeCompare(right));
}

async function writeUtf8NoFollow(path: string, text: string): Promise<void> {
  const flags =
    constants.O_WRONLY |
    constants.O_CREAT |
    constants.O_TRUNC |
    noFollowFlag();
  const handle = await open(path, flags, 0o600);
  try {
    await handle.writeFile(text, { encoding: "utf8" });
  } finally {
    await handle.close();
  }
}

function noFollowFlag(): number {
  return typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
}

function stringArgument(
  request: ToolCallRequest,
  name: string,
  position: number,
): string {
  const value = request.namedArguments[name] ?? request.arguments[position];
  if (typeof value !== "string") {
    throw new HostAdapterError(`${request.name} requires Text argument :${name}.`);
  }
  return value;
}

function normalizeAllowedHost(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (
    trimmed.length === 0 ||
    trimmed.includes("://") ||
    trimmed.includes("/") ||
    trimmed.includes("?") ||
    trimmed.includes("#") ||
    trimmed.includes("@")
  ) {
    throw new HostAdapterError(`Invalid --allow-net host: ${value}`);
  }
  let parsed: URL;
  try {
    parsed = new URL(`http://${trimmed}`);
  } catch {
    throw new HostAdapterError(`Invalid --allow-net host: ${value}`);
  }
  if (!parsed.hostname || parsed.pathname !== "/") {
    throw new HostAdapterError(`Invalid --allow-net host: ${value}`);
  }
  return parsed.host.toLowerCase();
}

function parseHttpUrl(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new HostAdapterError(`Http.get requires an absolute HTTP URL: ${value}`);
  }
  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username !== "" ||
    parsed.password !== ""
  ) {
    throw new HostAdapterError("Http.get allows only credential-free http/https URLs.");
  }
  return parsed;
}

function authorizeHost(url: URL, allowedHosts: readonly string[]): void {
  const host = url.host.toLowerCase();
  if (!allowedHosts.includes(host)) {
    throw new HostAdapterError(`Http.get host is not authorized: ${host}`);
  }
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

async function readResponseBody(response: Response, limit: number): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    await response.body?.cancel();
    throw new HostAdapterError(`Http.get response exceeds ${limit} bytes.`);
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new HostAdapterError(`Http.get response exceeds ${limit} bytes.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

function isMissingPathError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    ((error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error as NodeJS.ErrnoException).code === "ENOTDIR")
  );
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function validatePositiveLimit(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new HostAdapterError(`${name} must be a positive integer.`);
  }
}
