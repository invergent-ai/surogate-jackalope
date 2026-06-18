# Contributing to Jackalope

Thanks for your interest in improving Jackalope — the desktop app for the
[Surogate](https://github.com/invergent-ai/surogate) training engine. Bug reports,
features, and pull requests are all welcome.

## Ways to help

- **Report bugs** — [open an issue](https://github.com/invergent-ai/surogate-jackalope/issues)
  with your OS, what you did, and what happened.
- **Request features** — tell us what would make training and fine-tuning smoother.
- **Send a PR** — fixes, polish, new panels, or support for more compute targets.

## Development setup

Requirements: **Node ≥ 20**, **Rust** (stable). On Linux also install the WebKitGTK
/ GTK dev packages (`webkit2gtk-4.1`, `libappindicator3`, `librsvg2`).

```bash
npm install
npm run tauri dev          # run with hot reload
```

Project layout:

- `src/` — React + TypeScript UI (panels, components, typed IPC).
- `src-tauri/src/` — the Rust core (one focused module per concern: `feed`,
  `launch`, `cloud`, `ssh`, `grpo`, `process`, `runs`, `artifacts`, `commands`).

## Before opening a PR

```bash
npm run build                                      # typecheck + bundle the UI
npm test                                           # frontend tests (Vitest)
cargo test --manifest-path src-tauri/Cargo.toml    # Rust unit tests
```

Please keep changes focused, match the surrounding style, and add a test when you
fix a bug or add logic. Commit messages: short imperative subject (e.g.
`fix: …`, `feat: …`).

## Releases

Tagging `vX.Y.Z` triggers CI to build the native installers for Linux, macOS, and
Windows and attach them to a GitHub Release.

## License

By contributing, you agree that your contributions are licensed under the
[Apache License 2.0](LICENSE).
