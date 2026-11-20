# SQLite Viewer (Local)

A free, read-only SQLite viewer for VS Code. Open any `.db`, `.sqlite`, `.sqlite3`, `.db3`, `.s3db` or `.sl3` file and it opens in a table browser.

- Browse tables and views with row counts, column types and primary keys
- Page through rows 200 at a time
- Run SQL queries (⌘/Ctrl + Enter). Changes stay in memory; the file is never modified
- Reloads automatically when the file changes on disk
- Follows your VS Code theme

Powered by [sql.js](https://github.com/sql-js/sql.js) (SQLite compiled to WebAssembly). No native build step.

## Install

```sh
curl -fsSL -o /tmp/sqlite-viewer-local.vsix \
  https://github.com/ChristopherAlphonse/sqlite-viewer-local/releases/latest/download/sqlite-viewer-local.vsix \
  && code --install-extension /tmp/sqlite-viewer-local.vsix --force
```

Run the same command again to update.

## Develop

```sh
npm install
npm run package                     # builds sqlite-viewer-local.vsix
code --install-extension sqlite-viewer-local.vsix --force
```

Files: `extension.js` opens the database and runs queries; `media/viewer.js` and `media/viewer.css` are the UI.

## Release

Bump `version` in `package.json`, commit, then:

```sh
npm run package
gh release create "v$(node -p 'require("./package.json").version')" sqlite-viewer-local.vsix --generate-notes
```
