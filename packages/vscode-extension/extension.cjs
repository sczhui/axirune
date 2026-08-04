'use strict'

const path = require('node:path')
const childProcess = require('node:child_process')
const vscode = require('vscode')

let server
let sequence = 1
let buffer = Buffer.alloc(0)
const documents = new Map()
const pending = new Map()

function send(message) {
  if (!server?.stdin.writable) return
  const body = Buffer.from(JSON.stringify(message), 'utf8')
  server.stdin.write(`Content-Length: ${body.length}\r\n\r\n`)
  server.stdin.write(body)
}

function request(method, params) {
  const id = sequence++
  send({ jsonrpc: '2.0', id, method, params })
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`${method} timed out.`))
    }, 10_000)
    pending.set(id, {
      resolve(value) {
        clearTimeout(timer)
        resolve(value)
      },
      reject(error) {
        clearTimeout(timer)
        reject(error)
      },
    })
  })
}

function consume(chunk) {
  buffer = Buffer.concat([buffer, chunk])
  for (;;) {
    const marker = buffer.indexOf('\r\n\r\n')
    if (marker < 0) return
    const header = buffer.subarray(0, marker).toString('ascii')
    const match = /Content-Length:\s*(\d+)/i.exec(header)
    if (!match) {
      buffer = buffer.subarray(marker + 4)
      continue
    }
    const length = Number(match[1])
    const start = marker + 4
    if (buffer.length < start + length) return
    const message = JSON.parse(buffer.subarray(start, start + length).toString('utf8'))
    buffer = buffer.subarray(start + length)
    if (message.method === 'textDocument/publishDiagnostics') {
      publishDiagnostics(message.params)
    } else if (Object.prototype.hasOwnProperty.call(message, 'id')) {
      const waiter = pending.get(message.id)
      if (waiter) {
        pending.delete(message.id)
        if (message.error) waiter.reject(new Error(message.error.message || 'LSP request failed.'))
        else waiter.resolve(message.result)
      }
    }
  }
}

const diagnosticCollection = vscode.languages.createDiagnosticCollection('axirune')

function publishDiagnostics(params) {
  const uri = vscode.Uri.parse(params.uri)
  const diagnostics = (params.diagnostics || []).map((item) => {
    const range = new vscode.Range(
      item.range.start.line,
      item.range.start.character,
      item.range.end.line,
      item.range.end.character,
    )
    const diagnostic = new vscode.Diagnostic(range, item.message, item.severity || 1)
    diagnostic.code = item.code
    diagnostic.source = 'Axirune'
    return diagnostic
  })
  diagnosticCollection.set(uri, diagnostics)
}

function asRange(range) {
  return new vscode.Range(
    range.start.line,
    range.start.character,
    range.end.line,
    range.end.character,
  )
}

function positionParams(document, position) {
  return {
    textDocument: { uri: document.uri.toString() },
    position: { line: position.line, character: position.character },
  }
}

function documentParams(document) {
  return { textDocument: { uri: document.uri.toString() } }
}

function asMarkdown(contents) {
  if (typeof contents === 'string') return new vscode.MarkdownString(contents)
  if (contents && typeof contents.value === 'string') {
    return new vscode.MarkdownString(contents.value)
  }
  return new vscode.MarkdownString('')
}

function asDocumentSymbol(item) {
  const symbol = new vscode.DocumentSymbol(
    item.name,
    item.detail || '',
    item.kind,
    asRange(item.range),
    asRange(item.selectionRange),
  )
  symbol.children = (item.children || []).map(asDocumentSymbol)
  return symbol
}

async function safeRequest(method, params, fallback) {
  try {
    return await request(method, params)
  } catch (error) {
    console.error(`[Axirune LSP] ${error instanceof Error ? error.message : String(error)}`)
    return fallback
  }
}

function openDocument(document) {
  documents.set(document.uri.toString(), document.version)
  send({
    jsonrpc: '2.0',
    method: 'textDocument/didOpen',
    params: {
      textDocument: {
        uri: document.uri.toString(),
        languageId: 'axirune',
        version: document.version,
        text: document.getText(),
      },
    },
  })
}

function changeDocument(event) {
  documents.set(event.document.uri.toString(), event.document.version)
  send({
    jsonrpc: '2.0',
    method: 'textDocument/didChange',
    params: {
      textDocument: {
        uri: event.document.uri.toString(),
        version: event.document.version,
      },
      contentChanges: [{ text: event.document.getText() }],
    },
  })
}

function closeDocument(document) {
  documents.delete(document.uri.toString())
  diagnosticCollection.delete(document.uri)
  send({
    jsonrpc: '2.0',
    method: 'textDocument/didClose',
    params: { textDocument: { uri: document.uri.toString() } },
  })
}

function start(context) {
  const serverPath = path.join(context.extensionPath, 'server', 'src', 'lsp', 'server.js')
  server = childProcess.spawn(process.execPath, [serverPath, '--stdio'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  server.stdout.on('data', consume)
  server.stderr.on('data', (chunk) => console.error(`[Axirune LSP] ${chunk}`))
  server.on('exit', (code) => {
    if (code && code !== 0) {
      vscode.window.showWarningMessage(`Axirune language server stopped with code ${code}.`)
    }
  })
  void request('initialize', {
      processId: process.pid,
      rootUri: vscode.workspace.workspaceFolders?.[0]?.uri.toString() || null,
      capabilities: {},
      clientInfo: { name: 'Axirune VS Code', version: '0.4.0-alpha.1' },
    }).catch((error) => console.error(`[Axirune LSP] ${error.message}`))
  send({ jsonrpc: '2.0', method: 'initialized', params: {} })
  vscode.workspace.textDocuments.filter((doc) => doc.languageId === 'axirune').forEach(openDocument)
}

function stop() {
  if (!server) return
  send({ jsonrpc: '2.0', id: sequence++, method: 'shutdown', params: null })
  send({ jsonrpc: '2.0', method: 'exit', params: null })
  server.kill()
  server = undefined
  for (const waiter of pending.values()) waiter.reject(new Error('Axirune LSP stopped.'))
  pending.clear()
}

function activate(context) {
  start(context)
  const selector = { language: 'axirune' }
  context.subscriptions.push(
    diagnosticCollection,
    vscode.workspace.onDidOpenTextDocument((doc) => doc.languageId === 'axirune' && openDocument(doc)),
    vscode.workspace.onDidChangeTextDocument((event) =>
      event.document.languageId === 'axirune' && changeDocument(event),
    ),
    vscode.workspace.onDidCloseTextDocument((doc) => doc.languageId === 'axirune' && closeDocument(doc)),
    vscode.commands.registerCommand('axirune.restartServer', () => {
      stop()
      start(context)
      vscode.window.showInformationMessage('Axirune language server restarted.')
    }),
    vscode.commands.registerCommand('axirune.showManifest', () => {
      const terminal = vscode.window.createTerminal('Axirune Manifest')
      terminal.show()
      terminal.sendText(`axirune manifest "${vscode.window.activeTextEditor?.document.fileName || ''}"`)
    }),
    vscode.languages.registerCompletionItemProvider(
      selector,
      {
        async provideCompletionItems(document, position) {
          const result = await safeRequest(
            'textDocument/completion',
            positionParams(document, position),
            { items: [] },
          )
          return (result?.items || []).map((item) => {
            const completion = new vscode.CompletionItem(item.label, item.kind)
            completion.detail = item.detail
            completion.sortText = item.sortText
            completion.documentation = asMarkdown(item.documentation)
            completion.insertText =
              item.insertTextFormat === 2
                ? new vscode.SnippetString(item.insertText || item.label)
                : item.insertText || item.label
            return completion
          })
        },
      },
      '.',
      ' ',
    ),
    vscode.languages.registerHoverProvider(selector, {
      async provideHover(document, position) {
        const result = await safeRequest(
          'textDocument/hover',
          positionParams(document, position),
          null,
        )
        return result ? new vscode.Hover(asMarkdown(result.contents), asRange(result.range)) : null
      },
    }),
    vscode.languages.registerDefinitionProvider(selector, {
      async provideDefinition(document, position) {
        const result = await safeRequest(
          'textDocument/definition',
          positionParams(document, position),
          null,
        )
        return result
          ? new vscode.Location(vscode.Uri.parse(result.uri), asRange(result.range))
          : null
      },
    }),
    vscode.languages.registerDocumentSymbolProvider(selector, {
      async provideDocumentSymbols(document) {
        const result = await safeRequest(
          'textDocument/documentSymbol',
          documentParams(document),
          [],
        )
        return (result || []).map(asDocumentSymbol)
      },
    }),
    vscode.languages.registerDocumentFormattingEditProvider(selector, {
      async provideDocumentFormattingEdits(document, options) {
        const result = await safeRequest(
          'textDocument/formatting',
          {
            ...documentParams(document),
            options: {
              tabSize: options.tabSize,
              insertSpaces: options.insertSpaces,
            },
          },
          [],
        )
        return (result || []).map(
          (edit) => new vscode.TextEdit(asRange(edit.range), edit.newText),
        )
      },
    }),
  )
}

function deactivate() {
  stop()
}

module.exports = { activate, deactivate }
