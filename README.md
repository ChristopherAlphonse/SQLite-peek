# SQLite Peek

A free, read-only SQLite viewer for VS Code. Open any `.db`, `.sqlite`, `.sqlite3`, `.db3`, `.s3db` or `.sl3` file and it opens in a table browser.

- Browse tables and views with row counts, column types and primary keys
- Page through rows 200 at a time
- Run SQL queries (⌘/Ctrl + Enter). Changes stay in memory; the file is never modified
- Reloads automatically when the file changes on disk
- Follows your VS Code theme

![Browsing a table](media/images/browse.png)

![Running a SQL query](media/images/query.png)

![Viewing a table schema](media/images/schema.png)

Powered by [sql.js](https://github.com/sql-js/sql.js) (SQLite compiled to WebAssembly). No native build step.

## Install

Install **SQLite Peek** from the VS Code Marketplace, or from the command line:

```sh
code --install-extension christopheralphonse.sqlite-peek
```

Or install a release build directly:

```sh
curl -fsSL -o /tmp/sqlite-peek.vsix \
  https://github.com/ChristopherAlphonse/sqlite-viewer-local/releases/latest/download/sqlite-peek.vsix \
  && code --install-extension /tmp/sqlite-peek.vsix --force
```

## Limitations

- The whole file is loaded into memory, so very large databases (multiple GB) may fail to open.
- Only the main database file is read. Writes still sitting in a `-wal` file show up once SQLite checkpoints them into the main file.
