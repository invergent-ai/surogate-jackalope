<div align="center">

<img alt="Jackalope" width="150" src="https://raw.githubusercontent.com/invergent-ai/surogate-jackalope/main/assets/jackalope.svg" />

# Jackalope <sup><sub>by Surogate</sub></sup>

### The interface for training and fine-tuning models at the speed of light.

Pick a model, pick a dataset, click your GPUs, hit **Launch**, and watch the loss fall, live.

<a href="https://github.com/invergent-ai/surogate-jackalope/releases"><b>Download</b></a> ·
<a href="https://surogate.ai">surogate.ai</a> ·
<a href="https://docs.surogate.ai">Docs</a> ·
<a href="https://github.com/invergent-ai/surogate">Engine</a>

[![Release](https://img.shields.io/github/v/release/invergent-ai/surogate-jackalope?display_name=tag&color=ffd15c)](https://github.com/invergent-ai/surogate-jackalope/releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
![Linux](https://img.shields.io/badge/Linux-AppImage·deb·rpm-1793D1?logo=linux&logoColor=white)
![macOS](https://img.shields.io/badge/macOS-dmg-000000?logo=apple&logoColor=white)
![Windows](https://img.shields.io/badge/Windows-msi·exe-0078D6?logo=windows&logoColor=white)
[![Rust](https://img.shields.io/badge/Rust-000000?logo=rust&logoColor=white)](https://www.rust-lang.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tauri](https://img.shields.io/badge/Tauri%202-ffc131?logo=tauri&logoColor=black)](https://tauri.app)

</div>

---

Training a model usually means wrangling YAML, memorizing CLI flags, and squinting
at log files over SSH. **Jackalope** replaces all of that with a clean, native app:
a guided setup, a one-click launcher, and a real-time dashboard. The mission is
simple: let anyone start training and fine-tuning real models with Surogate, on
their own GPUs or in the cloud.

## Get started in one command

Paste this into your terminal. It installs the toolchain, runs a quick wizard,
sets up the Surogate Trainer, and wires the cloud clients (Modal, dstack).

**Linux / macOS**

```sh
curl -fsSL https://raw.githubusercontent.com/invergent-ai/surogate-jackalope/main/install.sh | sh
```

**Windows** (PowerShell)

```powershell
irm https://raw.githubusercontent.com/invergent-ai/surogate-jackalope/main/install.ps1 | iex
```

The wizard lets you pick how to install the Trainer (local, Docker, or from
source), creates a `uv` virtual environment, and gets everything in place. Then
grab the desktop app below, or run `surogate sft config.yaml`.

## What it does

| | |
|---|---|
| **Monitor** | Live loss curve, per-GPU temp, power, util and memory meters, step and epoch progress, throughput, and a streaming log, in real time. |
| **Launch** | **SFT**, **GRPO** and **RULER** (GRPO plus an LLM judge). Choose model, dataset, precision recipe and learning rate inline, then click your GPUs to select them. No typing indices. |
| **Train anywhere** | **Local** GPUs, a remote **SSH** box, a serverless **Modal** sandbox, or your own cloud via **dstack**. Secrets stay in each tool's own store, never in Jackalope. |
| **Models & datasets** | Search the Hugging Face Hub right inside the app and line up a run. |
| **GPUs · Runs · Logs · Files** | Inspect local devices, browse past runs, stream logs, and pull trained artifacts back to disk. |
| **Setup & tips** | A guided first-run wizard and grounded, in-app tips. |
| **Light / dark** | A polished theme, easy on the eyes either way. |

## Install

Download the latest build for your OS from the
**[Releases](https://github.com/invergent-ai/surogate-jackalope/releases)** page:

| Platform | Package |
|----------|---------|
| **Linux** | `.AppImage` (portable), `.deb`, `.rpm` |
| **macOS** | `.dmg` for Apple Silicon and Intel |
| **Windows** | `.msi` / `.exe` installer |

Tiny native binaries (a few MB). Jackalope uses your OS's built-in webview, so there
is no bundled browser.

To run training you also need the **Surogate** engine reachable (locally, over SSH,
or in the cloud):

```bash
curl -LsSf https://github.com/invergent-ai/surogate/releases/latest/download/install.sh | bash
```

## Updates & roadmap

Jackalope ships on its own release channel. New versions land on the
[Releases](https://github.com/invergent-ai/surogate-jackalope/releases) page, and
each `vX.Y.Z` tag publishes fresh Linux, macOS, and Windows packages automatically.
The app grows feature by feature. On the way: in-app auto-update, richer run
comparison, artifact previews, and one-click serving of finished checkpoints.

## Build from source

Requirements: **Node ≥ 20** and **Rust** (stable). Linux also needs the WebKitGTK
and GTK dev packages (`webkit2gtk-4.1`, `libappindicator3`, `librsvg2`).

```bash
npm install
npm run tauri dev        # run with hot reload
npm run tauri build      # native installers for the current OS
```

## How it works

Jackalope does not reimplement training, it **drives Surogate**. A small **Rust**
core tails the JSONL metrics feed Surogate writes (`report_to: [surogate]`) to power
the live dashboard, and shells out to the `surogate` CLI to start runs (locally, in a
detached SSH/tmux session, a Modal sandbox, or via `dstack apply`). The **React** UI
is just the view; everything privileged happens in Rust.

---

## Powered by the Surogate Trainer

[**Surogate Trainer**](https://github.com/invergent-ai/surogate) is a
high-performance training framework with a native **C++/CUDA** core, built for fast
experimentation on-premise or in the cloud. Jackalope is its desktop front end.

| Area | Highlights |
|------|-----------|
| **Fine-tuning** | Full fine-tuning, LoRA, BnB / FP8 / NVFP4 QLoRA, stacked LoRA |
| **Precision** | BF16, native FP8 (E4M3/E5M2), and NVFP4 4-bit on Blackwell (B200/B300, RTX 50xx) |
| **RL** | GRPO with deterministic [RL environments](https://docs.surogate.ai/guides/rl-environments), plus RULER LLM-judge |
| **Scale** | Native [multi-GPU](https://docs.surogate.ai/guides/multi-gpu) and [multi-node](https://docs.surogate.ai/guides/multi-node) (Ray DDP) |
| **Offload** | Smart CPU offloading, fine-tune at native bf16 |
| **MoE** | Expert parallelism, load balancing, imbalance detection |
| **Adaptive** | Auto phase detection, early stopping, dynamic LR and token budgeting |

Runs on every modern NVIDIA GPU (sm80 through sm120). Read the
**[docs](https://docs.surogate.ai)** for the full feature set.

## The Surogate platform: multiply yourself

The Trainer is one piece of a larger story. [**Surogate**](https://surogate.ai) is
the intelligence factory for autonomous agents by **Invergent SA**: deploy agents
that run in the cloud 24/7, for you or for your customers. They run on **expert
models you own**, small specialized models trained on your own work that match or
beat frontier models on your tasks, at a fraction of the cost.

> **Most AI tools make you faster. Surogate multiplies you.**

Jackalope is the front door to the part that makes those expert models. Train one
here, then put it to work across the ecosystem:

| Project | What it is |
|---------|------------|
| [**Surogate**](https://surogate.ai) | The agent platform. Build, deploy and observe autonomous agents on expert models you own |
| [**Surogate Trainer**](https://github.com/invergent-ai/surogate) | The high-performance FP8/FP4 training and RL engine |
| [**Surogate Hub**](https://github.com/invergent-ai/surogate-hub) | Git for AI data. Version datasets and models with full lineage |
| [**Surogates**](https://github.com/invergent-ai/surogates) | Open platform for running managed agents at scale |

Learn more at **[surogate.ai](https://surogate.ai)**.

## Make training open for everyone

Surogate is built in the open, and it gets better with every star and pull request.
Add a model architecture, a precision recipe, or an RL environment, and help push
fast, accessible training forward for the whole community.

<div align="center">

[![Star Surogate](https://img.shields.io/github/stars/invergent-ai/surogate?style=social)](https://github.com/invergent-ai/surogate)

**[★ Star Surogate](https://github.com/invergent-ai/surogate)** · **[Contribute](https://github.com/invergent-ai/surogate/issues)**

Every star helps more people train their own models.

</div>

## Contributing

Contributions are welcome. See **[CONTRIBUTING.md](CONTRIBUTING.md)**, or
[open an issue](https://github.com/invergent-ai/surogate-jackalope/issues).

## License

[Apache License 2.0](LICENSE) · © Invergent SA
