# Changelog

## 1.0.2

- ci: release on push to main and publish before tagging

## 1.0.1

- feat: add AGENTS.md and CLAUDE.md for documentation; update .vscodeignore and README
- fix: update changelog entry retrieval to match version tags
- chore: update package scripts for release management and add vsce as devDependency
- fix: update GitHub Actions workflow for publishing and improve README with Trusted Publishing details
- feat: add GitHub Actions workflow for publishing and update README with publishing instructions
- feat: rename extension to SQLite Peek and update related files
- fix: update publisher name in package.json and README.md for consistency
- feat: release version 1.0.0 with new features and improvements

## 1.0.0

- First Marketplace release, renamed to SQLite Peek.
- New extension icon.
- Tables whose names start with `sqlite` are no longer hidden from the sidebar.
- One file watcher per database instead of one per open editor.
- Query results stay on screen when the file reloads.
- Pager uses the page size reported by the extension.
