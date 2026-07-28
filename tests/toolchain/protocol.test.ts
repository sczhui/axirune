import { describe, expect, it } from "vitest";
import { encodeMessage, MessageReader } from "../../src/lsp/protocol.js";
import type { JsonRpcMessage } from "../../src/lsp/types.js";

describe("stdio JSON-RPC framing", () => {
  it("reads split frames and UTF-8 payloads", () => {
    const messages: JsonRpcMessage[] = [];
    const reader = new MessageReader((message) => messages.push(message));
    const frame = encodeMessage({
      jsonrpc: "2.0",
      method: "example",
      params: { value: "光" },
    });

    reader.push(frame.subarray(0, 9));
    reader.push(frame.subarray(9, frame.length - 2));
    expect(messages).toHaveLength(0);
    reader.push(frame.subarray(frame.length - 2));

    expect(messages).toEqual([
      {
        jsonrpc: "2.0",
        method: "example",
        params: { value: "光" },
      },
    ]);
  });

  it("reads multiple frames from one chunk", () => {
    const messages: JsonRpcMessage[] = [];
    const reader = new MessageReader((message) => messages.push(message));
    const first = encodeMessage({ jsonrpc: "2.0", id: 1, method: "initialize" });
    const second = encodeMessage({ jsonrpc: "2.0", id: 2, method: "shutdown" });
    reader.push(Buffer.concat([first, second]));
    expect(messages).toHaveLength(2);
  });
});
