export type JsonRpcId = number | string | null;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: unknown;
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcResponse;

export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface TextDocumentIdentifier {
  uri: string;
}

export interface VersionedTextDocumentIdentifier extends TextDocumentIdentifier {
  version: number;
}

export interface TextDocumentItem extends VersionedTextDocumentIdentifier {
  languageId: string;
  text: string;
}

export interface TextDocumentContentChangeEvent {
  range?: Range;
  rangeLength?: number;
  text: string;
}

export interface DidOpenTextDocumentParams {
  textDocument: TextDocumentItem;
}

export interface DidChangeTextDocumentParams {
  textDocument: VersionedTextDocumentIdentifier;
  contentChanges: TextDocumentContentChangeEvent[];
}

export interface DidCloseTextDocumentParams {
  textDocument: TextDocumentIdentifier;
}

export interface TextDocumentPositionParams {
  textDocument: TextDocumentIdentifier;
  position: Position;
}

export interface DocumentFormattingParams {
  textDocument: TextDocumentIdentifier;
  options?: {
    tabSize?: number;
    insertSpaces?: boolean;
  };
}

export interface LspDiagnostic {
  range: Range;
  severity: 1 | 2 | 3;
  code: string;
  source: "Nexilume";
  message: string;
  data?: {
    phase: string;
    hint?: string;
  };
}

export interface TextEdit {
  range: Range;
  newText: string;
}

export interface Location {
  uri: string;
  range: Range;
}

export interface DocumentSymbol {
  name: string;
  detail?: string;
  kind: number;
  range: Range;
  selectionRange: Range;
  children?: DocumentSymbol[];
}
