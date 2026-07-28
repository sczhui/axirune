import { describe, expect, it } from "vitest";
import { NexilumeLanguageServer } from "../../src/lsp/server.js";
import type {
  JsonRpcMessage,
  JsonRpcResponse,
} from "../../src/lsp/types.js";

const SOURCE = `space glow

task main
  give Text
  emit «hello»
  yield «done»
/task

launch main
`;

describe("Nexilume language server", () => {
  it("advertises the implemented language features", async () => {
    const sent: JsonRpcMessage[] = [];
    const server = new NexilumeLanguageServer({ send: (message) => sent.push(message) });
    await server.handle({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { capabilities: {} },
    });

    const response = sent[0] as JsonRpcResponse;
    expect(response.id).toBe(1);
    expect(response.result).toMatchObject({
      capabilities: {
        hoverProvider: true,
        definitionProvider: true,
        documentSymbolProvider: true,
        documentFormattingProvider: true,
      },
    });
  });

  it("publishes diagnostics and serves completion, hover, symbols and formatting", async () => {
    const sent: JsonRpcMessage[] = [];
    const server = new NexilumeLanguageServer({ send: (message) => sent.push(message) });
    await server.handle({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {},
    });
    await server.handle({
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: {
        textDocument: {
          uri: "file:///glow.nxl",
          languageId: "nexilume",
          version: 1,
          text: SOURCE,
        },
      },
    });
    expect(
      sent.some(
        (message) =>
          "method" in message && message.method === "textDocument/publishDiagnostics",
      ),
    ).toBe(true);

    await server.handle({
      jsonrpc: "2.0",
      id: 2,
      method: "textDocument/completion",
      params: {
        textDocument: { uri: "file:///glow.nxl" },
        position: { line: 4, character: 2 },
      },
    });
    const completion = responseResult(sent, 2) as { items: { label: string }[] };
    expect(completion.items.some((item) => item.label === "main")).toBe(true);
    expect(completion.items.some((item) => item.label === "task frame")).toBe(true);

    await server.handle({
      jsonrpc: "2.0",
      id: 3,
      method: "textDocument/hover",
      params: {
        textDocument: { uri: "file:///glow.nxl" },
        position: { line: 2, character: 1 },
      },
    });
    expect(responseResult(sent, 3)).toMatchObject({
      contents: { kind: "markdown" },
    });

    await server.handle({
      jsonrpc: "2.0",
      id: 4,
      method: "textDocument/documentSymbol",
      params: { textDocument: { uri: "file:///glow.nxl" } },
    });
    expect(responseResult(sent, 4)).toMatchObject([
      {
        name: "glow",
        children: [{ name: "main", detail: "task" }],
      },
    ]);

    await server.handle({
      jsonrpc: "2.0",
      method: "textDocument/didChange",
      params: {
        textDocument: { uri: "file:///glow.nxl", version: 2 },
        contentChanges: [
          {
            text: "space glow\ntask main\nemit «hello»\nyield «done»\n/task\nlaunch main",
          },
        ],
      },
    });
    await server.handle({
      jsonrpc: "2.0",
      id: 5,
      method: "textDocument/formatting",
      params: {
        textDocument: { uri: "file:///glow.nxl" },
        options: { tabSize: 2, insertSpaces: true },
      },
    });
    const edits = responseResult(sent, 5) as { newText: string }[];
    expect(edits).toHaveLength(1);
    expect(edits[0]?.newText).toContain("  emit");
  });

  it("honors shutdown and exit", async () => {
    let exitCode: number | undefined;
    const server = new NexilumeLanguageServer({
      send: () => undefined,
      onExit: (code) => {
        exitCode = code;
      },
    });
    await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    await server.handle({ jsonrpc: "2.0", id: 2, method: "shutdown" });
    await server.handle({ jsonrpc: "2.0", method: "exit" });
    expect(exitCode).toBe(0);
  });

  it("recomputes diagnostics after an incremental edit", async () => {
    const sent: JsonRpcMessage[] = [];
    const server = new NexilumeLanguageServer({ send: (message) => sent.push(message) });
    await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    await server.handle({
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: {
        textDocument: {
          uri: "file:///broken.nxl",
          languageId: "nexilume",
          version: 1,
          text: SOURCE,
        },
      },
    });
    await server.handle({
      jsonrpc: "2.0",
      method: "textDocument/didChange",
      params: {
        textDocument: { uri: "file:///broken.nxl", version: 2 },
        contentChanges: [
          {
            range: {
              start: { line: 6, character: 0 },
              end: { line: 7, character: 0 },
            },
            text: "",
          },
        ],
      },
    });
    const publications = sent.filter(
      (message) =>
        "method" in message && message.method === "textDocument/publishDiagnostics",
    ) as {
      params: { version: number; diagnostics: { severity: number; code: string }[] };
    }[];
    const latest = publications.at(-1)?.params;
    expect(latest?.version).toBe(2);
    expect(latest?.diagnostics.some((item) => item.severity === 1)).toBe(true);
  });
});

function responseResult(messages: JsonRpcMessage[], id: number): unknown {
  const response = messages.find(
    (message): message is JsonRpcResponse =>
      "id" in message && message.id === id && !("method" in message),
  );
  expect(response).toBeDefined();
  expect(response?.error).toBeUndefined();
  return response?.result;
}
