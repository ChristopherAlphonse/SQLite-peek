const vscode = require("vscode");
const path = require("node:path");
const crypto = require("node:crypto");
const initSqlJs = require("sql.js/dist/sql-wasm.js");

const PAGE_SIZE = 200;
const ICON_DB =
  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><ellipse cx="12" cy="5.5" rx="7.5" ry="3"/><path d="M4.5 5.5v13c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-13"/><path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/></svg>';
let sqlPromise;

const loadSql = () => {
  sqlPromise ??= initSqlJs({
    locateFile: (file) => path.join(__dirname, "node_modules", "sql.js", "dist", file),
  });
  return sqlPromise;
};

const quoteIdent = (name) => `"${String(name).replaceAll('"', '""')}"`;

const toCell = (v) => {
  if (v instanceof Uint8Array) return { blob: v.length };
  return v;
};

const rowsOf = (result) => ({
  columns: result?.columns ?? [],
  rows: (result?.values ?? []).map((r) => r.map(toCell)),
});

class SqliteDocument {
  constructor(uri) {
    this.uri = uri;
    this.db = undefined;
    this.size = 0;
    this.reloadEmitter = new vscode.EventEmitter();
    this.onDidReload = this.reloadEmitter.event;
    this.watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.joinPath(uri, ".."), path.basename(uri.fsPath)),
    );
    this.watcher.onDidChange(() => this.scheduleReload());
    this.watcher.onDidCreate(() => this.scheduleReload());
  }

  async load() {
    const SQL = await loadSql();
    const bytes = await vscode.workspace.fs.readFile(this.uri);
    const next = new SQL.Database(bytes);
    this.db?.close();
    this.db = next;
    this.size = bytes.byteLength;
  }

  scheduleReload() {
    clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      try {
        await this.load();
        this.reloadEmitter.fire(undefined);
      } catch (err) {
        this.reloadEmitter.fire(err);
      }
    }, 300);
  }

  dispose() {
    clearTimeout(this.timer);
    this.watcher.dispose();
    this.reloadEmitter.dispose();
    this.db?.close();
    this.db = undefined;
  }
}

class SqliteViewerProvider {
  constructor(context) {
    this.context = context;
  }

  async openCustomDocument(uri) {
    const doc = new SqliteDocument(uri);
    await doc.load();
    return doc;
  }

  async resolveCustomEditor(doc, panel) {
    const media = vscode.Uri.joinPath(this.context.extensionUri, "media");
    panel.webview.options = { enableScripts: true, localResourceRoots: [media] };
    panel.webview.html = this.html(panel.webview, media);

    const post = (msg) => panel.webview.postMessage(msg);

    const sendTables = () => {
      const res = doc.db.exec(
        "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' ORDER BY type, name",
      );
      const tables = (res[0]?.values ?? []).map(([name, type]) => {
        let count = null;
        try {
          count = doc.db.exec(`SELECT COUNT(*) FROM ${quoteIdent(name)}`)[0].values[0][0];
        } catch {}
        return { name, type, count };
      });
      post({
        type: "tables",
        tables,
        file: path.basename(doc.uri.fsPath),
        bytes: doc.size,
      });
    };

    const handlers = {
      ready: sendTables,
      page: ({ table, offset: rawOffset }) => {
        const offset = Math.max(0, Math.trunc(Number(rawOffset)) || 0);
        const res = doc.db.exec(`SELECT * FROM ${quoteIdent(table)} LIMIT ${PAGE_SIZE} OFFSET ${offset}`);
        const info = doc.db.exec(`PRAGMA table_info(${quoteIdent(table)})`)[0]?.values ?? [];
        const meta = Object.fromEntries(info.map((r) => [r[1], { type: r[2], pk: r[5] > 0 }]));
        const columns = res[0]?.columns ?? info.map((r) => r[1]);
        post({
          type: "page",
          table,
          offset,
          pageSize: PAGE_SIZE,
          ...rowsOf(res[0]),
          columns,
          meta: columns.map((c) => meta[c] ?? { type: "", pk: false }),
        });
      },
      schema: ({ table }) => {
        const res = doc.db.exec("SELECT sql FROM sqlite_master WHERE name = ?", [table]);
        post({ type: "schema", table, sql: res[0]?.values[0]?.[0] ?? "" });
      },
      query: ({ sql }) => {
        const started = Date.now();
        const results = doc.db.exec(sql);
        const last = results.at(-1);
        post({
          type: "query",
          ms: Date.now() - started,
          changes: doc.db.getRowsModified(),
          ...rowsOf(last),
        });
      },
    };

    const subscriptions = [
      panel.webview.onDidReceiveMessage((msg) => {
        try {
          handlers[msg?.type]?.(msg);
        } catch (err) {
          post({ type: "error", message: String(err?.message ?? err) });
        }
      }),
      doc.onDidReload((err) => {
        if (err) {
          post({ type: "error", message: `Reload failed: ${err?.message ?? err}` });
          return;
        }
        post({ type: "reloaded" });
        sendTables();
      }),
    ];
    panel.onDidDispose(() => subscriptions.forEach((s) => s.dispose()));
  }

  html(webview, media) {
    const nonce = crypto.randomBytes(16).toString("base64");
    const js = webview.asWebviewUri(vscode.Uri.joinPath(media, "viewer.js"));
    const css = webview.asWebviewUri(vscode.Uri.joinPath(media, "viewer.css"));
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${css}">
</head>
<body>
<aside id="sidebar">
  <header class="brand">
    <div class="logo">${ICON_DB}</div>
    <div class="brand-text"><div id="file" class="file"></div><div id="filemeta" class="muted small"></div></div>
  </header>
  <div class="search"><input id="filter" type="search" placeholder="Filter tables…" spellcheck="false"></div>
  <nav id="tables"></nav>
</aside>
<main>
  <header class="topbar">
    <div class="title">
      <h1 id="title">SQLite</h1>
      <div id="subtitle" class="chips"></div>
    </div>
    <div class="actions">
      <button id="schemaBtn" class="ghost" hidden>Schema</button>
      <button id="queryBtn" class="ghost">SQL</button>
    </div>
  </header>
  <pre id="schema" class="card code" hidden></pre>
  <section id="querybar" class="card" hidden>
    <textarea id="sql" spellcheck="false" placeholder="SELECT * FROM …"></textarea>
    <div class="querybar-foot">
      <span class="muted small">⌘/Ctrl + Enter to run · changes stay in memory, the file is never modified</span>
      <button id="run" class="primary">▶ Run</button>
    </div>
  </section>
  <div id="gridwrap"><div id="grid"></div></div>
  <footer class="statusbar">
    <span id="status" class="muted"></span>
    <div id="pager" hidden><button id="prev" class="ghost icon" title="Previous page">‹</button><span id="pageinfo"></span><button id="next" class="ghost icon" title="Next page">›</button></div>
  </footer>
</main>
<script nonce="${nonce}" src="${js}"></script>
</body>
</html>`;
  }
}

exports.activate = (context) => {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      "localSqlite.viewer",
      new SqliteViewerProvider(context),
      { webviewOptions: { retainContextWhenHidden: true }, supportsMultipleEditorsPerDocument: true },
    ),
  );
};

exports.deactivate = () => {};
