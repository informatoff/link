"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode = __toESM(require("vscode"));
var path = __toESM(require("path"));
var fs = __toESM(require("fs"));
function resolveLinkCli(ctx) {
  const candidates = [
    path.resolve(ctx.extensionPath, "..", "core", "bin", "link.js"),
    path.resolve(ctx.extensionPath, "..", "..", "packages", "core", "bin", "link.js"),
    path.resolve(__dirname, "..", "..", "core", "bin", "link.js")
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return `node "${c}"`;
  }
  return "npx link";
}
function activate(context) {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection("link");
  context.subscriptions.push(diagnosticCollection);
  const checkDocument = (document) => {
    if (document.languageId !== "link") return;
    const text = document.getText();
    const diagnostics = [];
    let depth = 0;
    let lastOpen = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "{") {
        depth++;
        lastOpen = i;
      }
      if (text[i] === "}") {
        depth--;
      }
    }
    if (depth !== 0) {
      const pos = document.positionAt(lastOpen);
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(pos, pos.translate(0, 1)),
        "Unclosed block \u2014 missing closing `}`",
        vscode.DiagnosticSeverity.Error
      ));
    }
    diagnosticCollection.set(document.uri, diagnostics);
  };
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => checkDocument(e.document)),
    vscode.workspace.onDidOpenTextDocument((doc) => checkDocument(doc))
  );
  const completionProvider = vscode.languages.registerCompletionItemProvider(
    { language: "link", scheme: "file" },
    {
      provideCompletionItems(document, position) {
        const prefix = document.lineAt(position).text.slice(0, position.character);
        const dotMap = {
          "net.": ["get", "post"],
          "db.": ["get", "set", "has", "delete"],
          "log.": ["info", "warn", "error", "debug"],
          "time.": ["now", "timestamp"],
          "json.": ["parse", "stringify"],
          "crypto.": ["hash", "randomToken"]
        };
        for (const [trigger, methods] of Object.entries(dotMap)) {
          if (prefix.endsWith(trigger)) {
            return methods.map((m) => {
              const item = new vscode.CompletionItem(m, vscode.CompletionItemKind.Method);
              item.detail = `${trigger}${m}()`;
              return item;
            });
          }
        }
        const keywords = [
          "let",
          "const",
          "flow",
          "fn",
          "async",
          "await",
          "return",
          "if",
          "else",
          "elif",
          "for",
          "in",
          "while",
          "loop",
          "break",
          "continue",
          "try",
          "catch",
          "finally",
          "throw",
          "link",
          "listen",
          "on",
          "send",
          "hook",
          "route",
          "emit",
          "event",
          "channel",
          "wait",
          "retry",
          "import",
          "export",
          "struct"
        ];
        return keywords.map((kw) => new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword));
      }
    },
    "."
  );
  context.subscriptions.push(completionProvider);
  const runFileCmd = vscode.commands.registerCommand("link.runFile", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 .lk \u0444\u0430\u0439\u043B \u0434\u043B\u044F \u0437\u0430\u043F\u0443\u0441\u043A\u0430.");
      return;
    }
    const filePath = editor.document.fileName;
    const cli = resolveLinkCli(context);
    const terminal = vscode.window.terminals.find((t) => t.name === "Link Runner") || vscode.window.createTerminal({ name: "Link Runner", cwd: path.dirname(filePath) });
    terminal.show(true);
    terminal.sendText(`${cli} run "${filePath}"`);
  });
  const newProjectCmd = vscode.commands.registerCommand("link.newProject", async () => {
    const name = await vscode.window.showInputBox({
      prompt: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043D\u043E\u0432\u043E\u0433\u043E Link-\u0431\u043E\u0442 \u043F\u0440\u043E\u0435\u043A\u0442\u0430",
      value: "my-link-bot",
      validateInput: (v) => v.trim() ? null : "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435"
    });
    if (!name) return;
    const cli = resolveLinkCli(context);
    const terminal = vscode.window.createTerminal({ name: "Link CLI" });
    terminal.show(true);
    terminal.sendText(`${cli} init "${name}"`);
  });
  context.subscriptions.push(runFileCmd, newProjectCmd);
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.text = "$(link) Link";
  statusBarItem.tooltip = "Link Language \u2014 click to run";
  statusBarItem.command = "link.runFile";
  context.subscriptions.push(statusBarItem);
  const updateStatusBar = (editor) => {
    if (editor && editor.document.languageId === "link") {
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  };
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateStatusBar));
  updateStatusBar(vscode.window.activeTextEditor);
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
