#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LANGUAGE_NAME,
  LANGUAGE_SLUG,
  LANGUAGE_VERSION,
} from "../language/index.js";
import { TextDocumentStore } from "./documents.js";
import {
  completionsFor,
  definitionFor,
  diagnosticsFor,
  formattingFor,
  hoverFor,
  symbolsFor,
} from "./features.js";
import { encodeMessage, MessageReader } from "./protocol.js";
import type {
  DidChangeTextDocumentParams,
  DidCloseTextDocumentParams,
  DidOpenTextDocumentParams,
  DocumentFormattingParams,
  JsonRpcId,
  JsonRpcMessage,
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
  TextDocumentPositionParams,
} from "./types.js";

const ERROR = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
  serverNotInitialized: -32002,
} as const;

export interface LanguageServerOptions {
  send: (message: JsonRpcMessage) => void;
  onExit?: (code: number) => void;
  log?: (message: string) => void;
}

export class AxiruneLanguageServer {
  readonly documents = new TextDocumentStore();
  readonly #send: (message: JsonRpcMessage) => void;
  readonly #onExit: (code: number) => void;
  readonly #log: (message: string) => void;
  #initialized = false;
  #shutdownRequested = false;

  constructor(options: LanguageServerOptions) {
    this.#send = options.send;
    this.#onExit = options.onExit ?? (() => undefined);
    this.#log = options.log ?? (() => undefined);
  }

  async handle(message: JsonRpcMessage): Promise<void> {
    if (!isIncomingCall(message)) return;
    const request = hasId(message);
    try {
      const result = await this.dispatch(message.method, message.params);
      if (request) this.respond(message.id, result);
    } catch (error) {
      const rpcError = toRpcError(error);
      if (request) this.fail(message.id, rpcError.code, rpcError.message, rpcError.data);
      else this.#log(`${message.method}: ${rpcError.message}`);
    }
  }

  private async dispatch(method: string, params: unknown): Promise<unknown> {
    if (method === "initialize") {
      if (this.#initialized) {
        throw rpcFailure(ERROR.invalidRequest, "Axirune LSP is already initialized.");
      }
      this.#initialized = true;
      return initializeResult();
    }
    if (method === "exit") {
      this.#onExit(this.#shutdownRequested ? 0 : 1);
      return undefined;
    }
    if (!this.#initialized) {
      throw rpcFailure(ERROR.serverNotInitialized, "Initialize the Axirune LSP first.");
    }
    if (method === "shutdown") {
      this.#shutdownRequested = true;
      return null;
    }
    if (this.#shutdownRequested) {
      throw rpcFailure(ERROR.invalidRequest, "The Axirune LSP is shutting down.");
    }

    switch (method) {
      case "initialized":
      case "$/cancelRequest":
      case "workspace/didChangeConfiguration":
        return undefined;
      case "textDocument/didOpen":
        return this.didOpen(requireParams<DidOpenTextDocumentParams>(params, method));
      case "textDocument/didChange":
        return this.didChange(requireParams<DidChangeTextDocumentParams>(params, method));
      case "textDocument/didClose":
        return this.didClose(requireParams<DidCloseTextDocumentParams>(params, method));
      case "textDocument/completion":
        return this.withPosition(params, method, completionsFor);
      case "textDocument/hover":
        return this.withPosition(params, method, hoverFor);
      case "textDocument/definition":
        return this.withPosition(params, method, definitionFor);
      case "textDocument/documentSymbol":
        return this.withDocument(params, method, symbolsFor);
      case "textDocument/formatting":
        return this.withDocument(
          requireParams<DocumentFormattingParams>(params, method),
          method,
          formattingFor,
        );
      default:
        throw rpcFailure(ERROR.methodNotFound, `Method not found: ${method}`);
    }
  }

  private didOpen(params: DidOpenTextDocumentParams): void {
    validateDocumentItem(params.textDocument);
    const document = this.documents.open(params.textDocument);
    this.publishDiagnostics(document.uri);
  }

  private didChange(params: DidChangeTextDocumentParams): void {
    if (!params.textDocument?.uri || !Array.isArray(params.contentChanges)) {
      throw rpcFailure(ERROR.invalidParams, "didChange requires a document and contentChanges.");
    }
    const document = this.documents.change(params);
    if (document) this.publishDiagnostics(document.uri);
  }

  private didClose(params: DidCloseTextDocumentParams): void {
    const uri = requireUri(params, "textDocument/didClose");
    this.documents.close(uri);
    this.#send({
      jsonrpc: "2.0",
      method: "textDocument/publishDiagnostics",
      params: { uri, diagnostics: [] },
    });
  }

  private withPosition(
    params: unknown,
    method: string,
    feature: (
      document: NonNullable<ReturnType<TextDocumentStore["get"]>>,
      position: TextDocumentPositionParams["position"],
    ) => unknown,
  ): unknown {
    const actual = requireParams<TextDocumentPositionParams>(params, method);
    const uri = requireUri(actual, method);
    if (
      !actual.position ||
      !Number.isInteger(actual.position.line) ||
      !Number.isInteger(actual.position.character)
    ) {
      throw rpcFailure(ERROR.invalidParams, `${method} requires a valid position.`);
    }
    const document = this.documents.get(uri);
    return document ? feature(document, actual.position) : null;
  }

  private withDocument(
    params: unknown,
    method: string,
    feature: (document: NonNullable<ReturnType<TextDocumentStore["get"]>>) => unknown,
  ): unknown {
    const uri = requireUri(params, method);
    const document = this.documents.get(uri);
    return document ? feature(document) : null;
  }

  private publishDiagnostics(uri: string): void {
    const document = this.documents.get(uri);
    if (!document) return;
    this.#send({
      jsonrpc: "2.0",
      method: "textDocument/publishDiagnostics",
      params: {
        uri,
        version: document.version,
        diagnostics: diagnosticsFor(document),
      },
    });
  }

  private respond(id: JsonRpcId, result: unknown): void {
    const response: JsonRpcResponse = {
      jsonrpc: "2.0",
      id,
      result: result === undefined ? null : result,
    };
    this.#send(response);
  }

  private fail(id: JsonRpcId, code: number, message: string, data?: unknown): void {
    const response: JsonRpcResponse = {
      jsonrpc: "2.0",
      id,
      error: data === undefined ? { code, message } : { code, message, data },
    };
    this.#send(response);
  }
}

/** @deprecated Use AxiruneLanguageServer. */
export { AxiruneLanguageServer as NexilumeLanguageServer };

export function startStdioServer(): AxiruneLanguageServer {
  const server = new AxiruneLanguageServer({
    send: (message) => process.stdout.write(encodeMessage(message)),
    onExit: (code) => {
      process.exitCode = code;
      process.stdin.removeAllListeners();
      process.stdin.pause();
      setImmediate(() => process.exit(code));
    },
    log: (message) => process.stderr.write(`[${LANGUAGE_NAME} LSP] ${message}\n`),
  });
  const reader = new MessageReader(
    (message) => {
      void server.handle(message);
    },
    (error) => {
      process.stderr.write(`[${LANGUAGE_NAME} LSP] ${error.message}\n`);
      process.stdout.write(
        encodeMessage({
          jsonrpc: "2.0",
          id: null,
          error: { code: ERROR.parse, message: error.message },
        }),
      );
    },
  );
  process.stdin.on("data", (chunk: Buffer) => reader.push(chunk));
  process.stdin.resume();
  return server;
}

function initializeResult(): unknown {
  return {
    capabilities: {
      positionEncoding: "utf-16",
      textDocumentSync: {
        openClose: true,
        change: 2,
        save: false,
      },
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: [".", " "],
      },
      hoverProvider: true,
      definitionProvider: true,
      documentSymbolProvider: true,
      documentFormattingProvider: true,
    },
    serverInfo: {
      name: `${LANGUAGE_SLUG}-lsp`,
      version: LANGUAGE_VERSION,
    },
  };
}

function isIncomingCall(
  message: JsonRpcMessage,
): message is JsonRpcRequest | JsonRpcNotification {
  return (
    typeof message === "object" &&
    message !== null &&
    "method" in message &&
    typeof message.method === "string"
  );
}

function hasId(message: JsonRpcRequest | JsonRpcNotification): message is JsonRpcRequest {
  return Object.prototype.hasOwnProperty.call(message, "id");
}

function requireParams<T>(params: unknown, method: string): T {
  if (typeof params !== "object" || params === null) {
    throw rpcFailure(ERROR.invalidParams, `${method} requires object params.`);
  }
  return params as T;
}

function requireUri(params: unknown, method: string): string {
  const actual = requireParams<{ textDocument?: { uri?: unknown } }>(params, method);
  const uri = actual.textDocument?.uri;
  if (typeof uri !== "string" || uri.length === 0) {
    throw rpcFailure(ERROR.invalidParams, `${method} requires textDocument.uri.`);
  }
  return uri;
}

function validateDocumentItem(item: DidOpenTextDocumentParams["textDocument"]): void {
  if (
    !item ||
    typeof item.uri !== "string" ||
    typeof item.text !== "string" ||
    typeof item.languageId !== "string" ||
    !Number.isInteger(item.version)
  ) {
    throw rpcFailure(ERROR.invalidParams, "didOpen requires a valid textDocument.");
  }
}

interface RpcFailure extends Error {
  rpcCode: number;
  data?: unknown;
}

function rpcFailure(code: number, message: string, data?: unknown): RpcFailure {
  const error = new Error(message) as RpcFailure;
  error.rpcCode = code;
  if (data !== undefined) error.data = data;
  return error;
}

function toRpcError(error: unknown): { code: number; message: string; data?: unknown } {
  if (error instanceof Error && "rpcCode" in error) {
    const actual = error as RpcFailure;
    return actual.data === undefined
      ? { code: actual.rpcCode, message: actual.message }
      : { code: actual.rpcCode, message: actual.message, data: actual.data };
  }
  return {
    code: ERROR.internal,
    message: error instanceof Error ? error.message : String(error),
  };
}

const executedPath = process.argv[1] ? realpathSync(resolve(process.argv[1])) : "";
if (fileURLToPath(import.meta.url) === executedPath) startStdioServer();
