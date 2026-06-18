<div align="center">

<img alt="Jackalope" width="160" src="https://raw.githubusercontent.com/invergent-ai/surogate-jackalope/main/assets/jackalope.svg" />

# Jackalope

### Train and fine-tune models, beautifully — a desktop app for [Surogate](https://github.com/invergent-ai/surogate)

**FP8 / FP4 · Training · Fine-tuning · RL — without leaving your desktop**

<a href="https://surogate.ai">Home</a> ·
<a href="https://docs.surogate.ai">Docs</a> ·
<a href="https://github.com/invergent-ai/surogate">Surogate</a> ·
<a href="https://github.com/invergent-ai/surogates">Agents</a> ·
<a href="#install">Download</a>

<br/>

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/invergent-ai/surogate-jackalope?display_name=tag)](https://github.com/invergent-ai/surogate-jackalope/releases)
![Platforms](https://img.shields.io/badge/platforms-Linux%20·%20macOS%20·%20Windows-444)
![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202%20·%20Rust-ffd15c)

</div>

---

**Jackalope** is a native desktop app that puts the full power of the
[**Surogate**](https://github.com/invergent-ai/surogate) training engine behind a
clean, modern UI. Pick a model and a dataset, choose a precision recipe and your
GPUs, hit **Launch**, and watch the loss curve fall — live. No YAML wrangling, no
remembering CLI flags, no terminal required.

The goal is simple: **let anyone start training and fine-tuning real models** —
locally on your own GPUs, on a remote box, or in the cloud — and make the whole
Surogate workflow approachable, visual, and fast.

> It's a real desktop application — installs natively, runs offline, lives in your
> tray, and talks to your machine directly. It is **not** a web page in a window.

## ✨ Features

- **📈 Monitor** — a live loss chart, per-GPU temp/power/util/memory meters,
  step/epoch progress, throughput, and a streaming log — updated in real time as
  training runs.
- **🚀 Launch** — **SFT**, **GRPO**, and **RULER** (GRPO + an LLM judge), with an
  inline editor for the model, dataset, precision recipe, learning rate and more.
  Click your GPUs to select them — no typing indices.
- **☁️ Anywhere** — train on **Local** GPUs, a remote **SSH** box, a serverless
  **Modal** sandbox, or your own cloud via **dstack**. Credentials stay in each
  tool's own store — Jackalope never holds your secrets.
- **🔎 Models & Datasets** — search the Hugging Face Hub right in the app and line
  up a run.
- **🖥️ GPUs · Runs · Logs · Files** — see local devices, browse past runs, stream
  logs, and pull trained artifacts back to disk.
- **💡 Tips & Setup** — a guided first-run setup and grounded, in-app tips.
- **🌗 Light / dark** — a polished theme that's easy on the eyes either way.

## Install

Grab the latest build for your OS from the
**[Releases](https://github.com/invergent-ai/surogate-jackalope/releases)** page:

| OS | Package |
|----|---------|
| **Linux** | `.AppImage` (portable), `.deb`, `.rpm` |
| **macOS** | `.dmg` (Apple Silicon & Intel) |
| **Windows** | `.msi` / `.exe` installer |

Tiny native binaries (a few MB) — Jackalope uses your OS's built-in webview, so
there's no bundled browser.

To **run training**, you also need the **Surogate** engine reachable — locally,
over SSH, or in the cloud. See [Surogate install](https://github.com/invergent-ai/surogate#-quickstart)
(`curl -LsSf https://github.com/invergent-ai/surogate/releases/latest/download/install.sh | bash`).

## Build from source

Requirements: **Node ≥ 20**, **Rust** (stable). Linux also needs the WebKitGTK /
GTK dev packages (`webkit2gtk-4.1`, `libappindicator3`, `librsvg2`).

```bash
npm install
npm run tauri dev        # run with hot reload
npm run tauri build      # produce native installers for this OS
```

## How it works

Jackalope doesn't reimplement training — it drives Surogate. It **tails the JSONL
metrics feed** Surogate writes (`report_to: [surogate]`) to render the live
dashboard, and **shells out to the `surogate` CLI** to start runs (locally, over
SSH/tmux, in a Modal sandbox, or via `dstack apply`). Everything privileged — file
tailing, process supervision, the network — happens in a small Rust core; the UI
is just the view.

## Powered by Surogate

[**Surogate**](https://github.com/invergent-ai/surogate) is a high-performance
training engine with a native C++/CUDA core, built for fast experimentation
on-premise or in the cloud:

- **Pre-training & fine-tuning** — full fine-tuning, LoRA, and BnB / FP8 / NVFP4 **QLoRA**
- **Precision recipes** — **BF16**, native **FP8** (E4M3/E5M2), and **NVFP4** 4-bit on Blackwell (B200/B300, RTX 50xx)
- **Reinforcement learning** — **GRPO** training with deterministic [RL environments](https://docs.surogate.ai/guides/rl-environments)
- **Scale** — native [multi-GPU](https://docs.surogate.ai/guides/multi-gpu) and [multi-node](https://docs.surogate.ai/guides/multi-node) (Ray DDP)
- **Smart CPU offloading** — fine-tune at native bf16, making QLoRA optional
- **MoE** — expert parallelism, load balancing, imbalance detection
- **Adaptive training** — auto phase detection, early stopping, LR management
- Runs on all modern NVIDIA GPUs (sm80 → sm120)

Learn more at **[surogate.ai](https://surogate.ai)** · read the
**[docs](https://docs.surogate.ai)** · explore **[managed Agents](https://github.com/invergent-ai/surogates)**.

## Contributing

Contributions are welcome — see **[CONTRIBUTING.md](CONTRIBUTING.md)**. Found a bug
or want a feature? [Open an issue](https://github.com/invergent-ai/surogate-jackalope/issues).

## License

[Apache License 2.0](LICENSE).
