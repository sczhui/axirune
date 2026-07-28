import type { JsonRpcMessage } from "./types.js";

export class MessageReader {
  #buffer = Buffer.alloc(0);

  constructor(
    private readonly onMessage: (message: JsonRpcMessage) => void,
    private readonly onError: (error: Error) => void = () => undefined,
  ) {}

  push(chunk: Uint8Array | string): void {
    const incoming = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : Buffer.from(chunk);
    this.#buffer = Buffer.concat([this.#buffer, incoming]);

    for (;;) {
      const headerEnd = this.#buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const header = this.#buffer.subarray(0, headerEnd).toString("ascii");
      const lengthMatch = /^Content-Length:\s*(\d+)\s*$/imu.exec(header);
      if (!lengthMatch) {
        this.#buffer = this.#buffer.subarray(headerEnd + 4);
        this.onError(new Error("JSON-RPC frame is missing Content-Length."));
        continue;
      }

      const contentLength = Number(lengthMatch[1]);
      if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
        this.#buffer = this.#buffer.subarray(headerEnd + 4);
        this.onError(new Error("JSON-RPC Content-Length is invalid."));
        continue;
      }
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + contentLength;
      if (this.#buffer.length < bodyEnd) return;
      const body = this.#buffer.subarray(bodyStart, bodyEnd).toString("utf8");
      this.#buffer = this.#buffer.subarray(bodyEnd);
      try {
        const message = JSON.parse(body) as JsonRpcMessage;
        this.onMessage(message);
      } catch (error) {
        this.onError(
          new Error(`Invalid JSON-RPC payload: ${error instanceof Error ? error.message : String(error)}`),
        );
      }
    }
  }
}

export function encodeMessage(message: JsonRpcMessage): Buffer {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([
    Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii"),
    body,
  ]);
}
