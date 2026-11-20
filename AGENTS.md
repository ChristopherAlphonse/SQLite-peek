# AGENTS.md

SQLite Peek: a read-only SQLite viewer for VS Code, published as `christopheralphonse.sqlite-peek`.

## Layout

- `extension.js`: registers the `sqlitePeek.viewer` custom editor, loads the database with sql.js (WebAssembly), answers webview messages (`ready`, `page`, `schema`, `query`), and reloads when the file changes on disk.
- `media/viewer.js`, `media/viewer.css`: the webview UI. Plain DOM, no framework, no build step.
- `images/icon.png`: Marketplace icon, rendered from `images/icon.svg` (the SVG is not packaged).
- `media/images/`: README screenshots. Not packaged; the Marketplace loads them from GitHub.

## Rules

- Never write to the database file. Queries run against an in-memory copy; say so in any UI text about changes.
- Quote every identifier that comes from the webview with `quoteIdent`. Clamp numbers from the webview before putting them in SQL.
- Keep the webview CSP strict: scripts only by nonce, styles only from `webview.cspSource`.
- No comments in code. No new runtime dependencies besides `sql.js`.
- Keep the VSIX small. Anything not needed at runtime goes in `.vscodeignore`.

## Develop

```sh
npm install
npm run package                     # builds sqlite-peek.vsix
code --install-extension sqlite-peek.vsix --force
```

Before calling a change done:

```sh
node --check extension.js && node --check media/viewer.js
npm run package                     # must print DONE and list ~14 files
```

## Release

Releases come from one GitHub Actions workflow, `.github/workflows/publish.yml`. Never bump the version, tag, or write the changelog by hand.

```sh
npm run release          # patch bump, then watches the run
npm run release:minor
npm run release:major
```

Or **Actions → Release → Run workflow** on GitHub.

The workflow:

1. Bumps `version` in `package.json` and `package-lock.json`.
2. Adds a `CHANGELOG.md` entry built from the commit messages since the last `v*` tag.
3. Builds `sqlite-peek.vsix`.
4. Commits `Release vX.Y.Z`, tags `vX.Y.Z`, and pushes both to `main`.
5. Publishes to the Marketplace with Trusted Publishing (GitHub OIDC), so no token is stored.
6. Creates a GitHub release with the VSIX attached.

Write commit messages as they should read in the changelog. The run fails if the tag already exists, and only one release runs at a time.

The Trusted Publishing policy on publisher `christopheralphonse` allows owner `ChristopherAlphonse`, repository `sqlite-viewer-local`, workflow `publish.yml`. Renaming the workflow file or the repo breaks publishing until the policy is updated at https://marketplace.visualstudio.com/manage/publishers/christopheralphonse/trustedpublishing.

To upload by hand, use **New extension → Visual Studio Code** on the publisher page. The **Visual Studio** option fails with `Value cannot be null. Parameter name: v1`.
