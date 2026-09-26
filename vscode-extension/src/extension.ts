import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// ──────────────────────────────────────────────────────────────────
// Resolves the absolute path to packages/core/bin/link.js
// relative to the installed extension directory.
// ──────────────────────────────────────────────────────────────────
function resolveLinkCli(ctx: vscode.ExtensionContext): string {
  // When installed from VSIX: __dirname = <ext>/out
  // Monorepo: packages/vscode-extension/out  →  packages/core/bin/link.js
  const candidates = [
    path.resolve(ctx.extensionPath, '..', 'core', 'bin', 'link.js'),
    path.resolve(ctx.extensionPath, '..', '..', 'packages', 'core', 'bin', 'link.js'),
    path.resolve(__dirname, '..', '..', 'core', 'bin', 'link.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return `node "${c}"`;
  }
  return 'npx link'; // fallback
}

export function activate(context: vscode.ExtensionContext) {

  // ── 1. Real-time Syntax Diagnostics ────────────────────────────
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('link');
  context.subscriptions.push(diagnosticCollection);

  const checkDocument = (document: vscode.TextDocument) => {
    if (document.languageId !== 'link') return;
    const text = document.getText();
    const diagnostics: vscode.Diagnostic[] = [];

    // Simple brace balance check for real-time feedback
    let depth = 0;
    let lastOpen = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') { depth++; lastOpen = i; }
      if (text[i] === '}') { depth--; }
    }
    if (depth !== 0) {
      const pos = document.positionAt(lastOpen);
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(pos, pos.translate(0, 1)),
        'Unclosed block — missing closing `}`',
        vscode.DiagnosticSeverity.Error
      ));
    }

    diagnosticCollection.set(document.uri, diagnostics);
  };

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => checkDocument(e.document)),
    vscode.workspace.onDidOpenTextDocument((doc: vscode.TextDocument) => checkDocument(doc))
  );

  // ── 2. IntelliSense Completions ─────────────────────────────────
  const completionProvider = vscode.languages.registerCompletionItemProvider(
    { language: 'link', scheme: 'file' },
    {
      provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
        const prefix = document.lineAt(position).text.slice(0, position.character);

        // Dot completions
        const dotMap: Record<string, string[]> = {
          'net.':    ['get', 'post'],
          'db.':     ['get', 'set', 'has', 'delete'],
          'log.':    ['info', 'warn', 'error', 'debug'],
          'time.':   ['now', 'timestamp'],
          'json.':   ['parse', 'stringify'],
          'crypto.': ['hash', 'randomToken'],
        };
        for (const [trigger, methods] of Object.entries(dotMap)) {
          if (prefix.endsWith(trigger)) {
            return methods.map(m => {
              const item = new vscode.CompletionItem(m, vscode.CompletionItemKind.Method);
              item.detail = `${trigger}${m}()`;
              return item;
            });
          }
        }

        // Keywords
        const keywords = [
          'let', 'const', 'flow', 'fn', 'async', 'await', 'return',
          'if', 'else', 'elif', 'for', 'in', 'while', 'loop', 'break', 'continue',
          'try', 'catch', 'finally', 'throw',
          'link', 'listen', 'on', 'send', 'hook', 'route', 'emit', 'event',
          'channel', 'wait', 'retry', 'import', 'export', 'struct',
        ];
        return keywords.map(kw => new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword));
      },
    },
    '.'
  );
  context.subscriptions.push(completionProvider);

  // ── 3. Command: Link Run File (▶️ Play button) ──────────────────
  const runFileCmd = vscode.commands.registerCommand('link.runFile', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('Откройте .lk файл для запуска.');
      return;
    }

    const filePath = editor.document.fileName;
    const cli = resolveLinkCli(context);

    // Reuse existing terminal or create new one
    const terminal =
      vscode.window.terminals.find(t => t.name === 'Link Runner') ||
      vscode.window.createTerminal({ name: 'Link Runner', cwd: path.dirname(filePath) });

    terminal.show(true);
    terminal.sendText(`${cli} run "${filePath}"`);
  });

  // ── 4. Command: Link New Bot Project ────────────────────────────
  const newProjectCmd = vscode.commands.registerCommand('link.newProject', async () => {
    const name = await vscode.window.showInputBox({
      prompt: 'Название нового Link-бот проекта',
      value: 'my-link-bot',
      validateInput: (v) => v.trim() ? null : 'Введите название',
    });
    if (!name) return;

    const cli = resolveLinkCli(context);
    const terminal = vscode.window.createTerminal({ name: 'Link CLI' });
    terminal.show(true);
    terminal.sendText(`${cli} init "${name}"`);
  });

  context.subscriptions.push(runFileCmd, newProjectCmd);

  // Show status bar item for Link files
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.text = '$(link) Link';
  statusBarItem.tooltip = 'Link Language — click to run';
  statusBarItem.command = 'link.runFile';
  context.subscriptions.push(statusBarItem);

  const updateStatusBar = (editor?: vscode.TextEditor) => {
    if (editor && editor.document.languageId === 'link') {
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  };

  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateStatusBar));
  updateStatusBar(vscode.window.activeTextEditor);
}

export function deactivate() {}
