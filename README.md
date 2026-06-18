# Jackalope Desktop

A native desktop dashboard for [surogate](https://surogate.ai) training — the GUI
counterpart to the [jackalope](https://surogate.ai) terminal app. **Watch training
in real time and launch runs**, in a real desktop window on Linux, macOS, and
Windows.

Built with **Tauri 2** (Rust core + web UI rendered by the OS's native webview).
It is **not** a website in a window: it installs as a native app, has its own
window + system-tray icon, runs fully offline, and talks to the machine (spawns
`surogate`, tails the metrics feed) through its Rust backend.

> **Status:** vertical slice — **Monitor**, **Local SFT Launch**, **Runs**.
> Deferred: GRPO/RULER, SSH/Modal/dstack, HuggingFace browser, GPUs tab, Setup.

## How it works

Like jackalope, this app does not import surogate. It:

- **tails** the JSONL metrics feed surogate writes (`report_to: [surogate]`) and
  streams it to the UI, and
- **shells out** to the `surogate` CLI to start runs.

```
React/Vite UI  ──invoke()──►  Rust core  ──spawn──►  surogate CLI
   (webview)   ◄──events────  (tail+state) ◄─writes─  metrics.jsonl
```

## Architecture

- **Frontend** (`src/`) — React + TypeScript + Vite. uPlot for the live loss chart.
  - `lib/ipc.ts` typed `invoke`/`listen` wrappers · `lib/feed.ts` pure ring-buffer
    reducer · `panels/` Monitor·Launch·Runs · `components/` chart, GPU meters, logs.
- **Rust core** (`src-tauri/src/`)
  - `feed.rs` — tail the feed, parse lines into `Metric`, `emit` `metric`/`log` events
  - `launch.rs` — build the surogate YAML + args, spawn the run
  - `process.rs` — supervise the child (`Arc<Mutex<RunState>>`), stop/drain
  - `runs.rs` — read run records from disk
  - `config.rs` — settings (surogate bin, feed path, runs dir)
  - `commands.rs` — the IPC surface · `lib.rs` — builder, tray, menu, wiring

## Requirements

- **Node ≥ 20** and **Rust** (stable) to build from source.
- **Linux** build deps: `webkit2gtk-4.1`, `libappindicator3`, `librsvg2` and the
  usual GTK dev packages.
- To **launch training**: the `surogate` CLI reachable on `PATH` (configurable).

## Develop

```bash
npm install
npm run tauri dev      # launches the native window with hot-reload UI
```

Other scripts:

```bash
npm test                                   # Vitest (frontend reducer/logic)
cargo test --manifest-path src-tauri/Cargo.toml   # Rust unit tests
npm run build                              # typecheck + bundle the frontend
```

## Build native installers

```bash
npm run tauri build
```

Produces, under `src-tauri/target/release/bundle/`:

- **Linux** — `.deb`, `.rpm`, `.AppImage`
- **macOS** — `.dmg` / `.app`
- **Windows** — `.msi` / `.exe`

> **No cross-compilation.** Each OS's installer is built *on* that OS. Use a CI
> matrix (macOS + Windows + Linux runners) to produce all three, the same way the
> jackalope binary is released.

## Configure the feed

Enable the surogate feed in your training config so the Monitor has data to show:

```yaml
report_to: [surogate]
logging_steps: 1
log_gpu_util: 5
```

The default feed path is `<temp>/surogate_metrics.jsonl`; change it (and the
`surogate` binary path / runs directory) via the app's config, stored at
`<config-dir>/jackalope/config.json`.

## Why Tauri (and not Swift/Electron)

One Rust + web codebase compiles to native installers for all three desktops, with
tiny binaries (the `.deb`/`.rpm` here are ~4.6 MB). A native Swift/WinUI/GTK rewrite
would triple the work for capabilities this dashboard doesn't need; Electron would
bundle a whole Chromium. Tauri uses each OS's built-in webview instead.
