const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);

const ICONS = {
  table:
    '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1.5" y="2.5" width="13" height="11" rx="2"/><path d="M1.5 6.5h13M6 6.5v7"/></svg>',
  view: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z"/><circle cx="8" cy="8" r="2"/></svg>',
  key: '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="5" cy="8" r="3"/><path d="M8 8h7M12.5 8v2.5M14.5 8v2"/></svg>',
};

let current = null;
let tableList = [];
let pageSize = 200;
let showingQuery = false;

const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const c of children) node.append(c);
  return node;
};

const svg = (html, className = "icon") => {
  const span = el("span", { className });
  span.innerHTML = html;
  return span;
};

const fmtNum = (n) => (n == null ? "?" : Number(n).toLocaleString());
const fmtBytes = (b) => {
  if (b == null) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (b >= 1024 && i < units.length - 1) {
    b /= 1024;
    i++;
  }
  return `${b.toFixed(i ? 1 : 0)} ${units[i]}`;
};

const chip = (text, cls = "") => el("span", { className: `chip ${cls}`, textContent: text });

const typeClass = (type) => {
  const t = (type || "").toUpperCase();
  if (/INT|REAL|FLOA|DOUB|NUM|DEC/.test(t)) return "t-num";
  if (/CHAR|TEXT|CLOB/.test(t)) return "t-text";
  if (/BLOB/.test(t)) return "t-blob";
  if (/DATE|TIME/.test(t)) return "t-date";
  if (/BOOL/.test(t)) return "t-bool";
  return "";
};

const renderCell = (v) => {
  if (v === null) return el("td", { className: "null" }, [chip("NULL", "null")]);
  if (typeof v === "object" && "blob" in v)
    return el("td", { className: "blob" }, [chip(`BLOB · ${fmtBytes(v.blob)}`, "blob")]);
  if (typeof v === "number") return el("td", { className: "num", textContent: String(v) });
  const text = String(v);
  return el("td", {
    textContent: text.length > 300 ? `${text.slice(0, 300)}…` : text,
    title: text.length > 40 ? text.slice(0, 4000) : "",
  });
};

const renderGrid = (columns, rows, rowOffset = 0, meta = []) => {
  if (!columns.length) {
    $("grid").replaceChildren(el("div", { className: "empty" }, [el("div", { className: "empty-title", textContent: "No results" })]));
    return;
  }
  const head = el("tr", {}, [el("th", { className: "rownum", textContent: "#" })]);
  columns.forEach((c, i) => {
    const m = meta[i] ?? {};
    const th = el("th", {}, [
      el("div", { className: "colname" }, [...(m.pk ? [svg(ICONS.key, "pk")] : []), el("span", { textContent: c })]),
    ]);
    if (m.type) th.append(el("div", { className: `coltype ${typeClass(m.type)}`, textContent: m.type.toLowerCase() }));
    head.append(th);
  });
  const tbody = el("tbody");
  rows.forEach((row, i) => {
    const tr = el("tr", {}, [el("td", { className: "rownum", textContent: String(rowOffset + i + 1) })]);
    for (const v of row) tr.append(renderCell(v));
    tbody.append(tr);
  });
  if (!rows.length) {
    tbody.append(
      el("tr", {}, [el("td", { colSpan: columns.length + 1, className: "empty-row", textContent: "This table is empty" })]),
    );
  }
  $("grid").replaceChildren(el("table", {}, [el("thead", {}, [head]), tbody]));
  $("gridwrap").scrollTop = 0;
};

const setStatus = (text, isError = false) => {
  $("status").textContent = text;
  $("status").className = isError ? "error" : "muted";
};

const setTitle = (title, chips) => {
  $("title").textContent = title;
  $("subtitle").replaceChildren(...chips);
};

const markActive = (name) => {
  for (const item of document.querySelectorAll("#tables .item")) item.classList.toggle("active", item.dataset.name === name);
};

const openTable = (table, offset = 0) => {
  const info = tableList.find((t) => t.name === table);
  current = { table, offset, count: info?.count ?? null, type: info?.type ?? "table" };
  showingQuery = false;
  markActive(table);
  vscode.postMessage({ type: "page", table, offset });
  vscode.postMessage({ type: "schema", table });
  vscode.setState({ table, offset });
};

const runQuery = () => {
  const sql = $("sql").value.trim();
  if (!sql) return;
  current = null;
  showingQuery = true;
  markActive(null);
  $("pager").hidden = true;
  $("schema").hidden = true;
  $("schemaBtn").hidden = true;
  $("schemaBtn").classList.remove("on");
  setTitle("Query", []);
  setStatus("Running…");
  vscode.postMessage({ type: "query", sql });
};

const renderSidebar = () => {
  const q = $("filter").value.trim().toLowerCase();
  const groups = [
    ["Tables", tableList.filter((t) => t.type === "table")],
    ["Views", tableList.filter((t) => t.type === "view")],
  ];
  const nodes = [];
  for (const [label, items] of groups) {
    const shown = items.filter((t) => t.name.toLowerCase().includes(q));
    if (!items.length) continue;
    nodes.push(el("div", { className: "section" }, [el("span", { textContent: label }), el("span", { className: "muted", textContent: String(items.length) })]));
    for (const t of shown) {
      const item = el("div", { className: "item", title: t.name }, [
        svg(t.type === "view" ? ICONS.view : ICONS.table),
        el("span", { className: "name", textContent: t.name }),
        el("span", { className: "count", textContent: t.count == null ? "" : fmtNum(t.count) }),
      ]);
      item.dataset.name = t.name;
      item.addEventListener("click", () => openTable(t.name));
      nodes.push(item);
    }
  }
  if (!tableList.length) nodes.push(el("div", { className: "muted small pad", textContent: "No tables in this database." }));
  $("tables").replaceChildren(...nodes);
  markActive(current?.table);
};

$("run").addEventListener("click", runQuery);
$("sql").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    runQuery();
  }
});
$("filter").addEventListener("input", renderSidebar);
$("queryBtn").addEventListener("click", () => {
  const bar = $("querybar");
  bar.hidden = !bar.hidden;
  $("queryBtn").classList.toggle("on", !bar.hidden);
  if (!bar.hidden) {
    if (!$("sql").value && current) $("sql").value = `SELECT * FROM "${current.table.replaceAll('"', '""')}" LIMIT 100;`;
    $("sql").focus();
  }
});
$("schemaBtn").addEventListener("click", () => {
  $("schema").hidden = !$("schema").hidden;
  $("schemaBtn").classList.toggle("on", !$("schema").hidden);
});
$("prev").addEventListener("click", () => current && openTable(current.table, Math.max(0, current.offset - pageSize)));
$("next").addEventListener("click", () => current && openTable(current.table, current.offset + pageSize));

window.addEventListener("message", ({ data: msg }) => {
  switch (msg.type) {
    case "tables": {
      tableList = msg.tables;
      $("file").textContent = msg.file;
      const nTables = msg.tables.filter((t) => t.type === "table").length;
      $("filemeta").textContent = `${fmtBytes(msg.bytes)} · ${nTables} table${nTables === 1 ? "" : "s"}`;
      renderSidebar();
      if (showingQuery) break;
      const saved = vscode.getState();
      const target = current?.table ?? saved?.table;
      if (target && msg.tables.some((t) => t.name === target)) openTable(target, current?.offset ?? saved?.offset ?? 0);
      else if (!current && msg.tables[0]) openTable(msg.tables[0].name);
      else if (!msg.tables.length) setTitle(msg.file, []);
      break;
    }
    case "page": {
      if (!current || current.table !== msg.table) return;
      pageSize = msg.pageSize;
      renderGrid(msg.columns, msg.rows, msg.offset, msg.meta);
      setTitle(msg.table, [
        chip(current.type, "kind"),
        chip(`${fmtNum(current.count)} rows`),
        chip(`${msg.columns.length} columns`),
      ]);
      const end = msg.offset + msg.rows.length;
      $("pager").hidden = current.count != null && current.count <= msg.pageSize;
      $("pageinfo").textContent = `${msg.rows.length ? fmtNum(msg.offset + 1) : 0}–${fmtNum(end)} of ${fmtNum(current.count)}`;
      $("prev").disabled = msg.offset === 0;
      $("next").disabled = msg.rows.length < msg.pageSize;
      setStatus("");
      break;
    }
    case "schema":
      $("schema").textContent = msg.sql;
      $("schemaBtn").hidden = !msg.sql;
      break;
    case "query":
      renderGrid(msg.columns, msg.rows);
      if (msg.columns.length) setTitle("Query", [chip(`${fmtNum(msg.rows.length)} rows`), chip(`${msg.ms} ms`)]);
      setStatus(
        msg.columns.length ? "" : `Done in ${msg.ms} ms · ${msg.changes} row(s) changed in memory (file not modified)`,
      );
      break;
    case "reloaded":
      setStatus("File changed on disk · reloaded");
      break;
    case "error":
      setStatus(msg.message, true);
      break;
  }
});

vscode.postMessage({ type: "ready" });
