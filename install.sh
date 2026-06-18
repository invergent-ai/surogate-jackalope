#!/bin/sh
# Jackalope by Surogate - one-command setup wizard.
#
#   curl -fsSL https://raw.githubusercontent.com/invergent-ai/surogate-jackalope/main/install.sh | sh
#
# Bootstraps a full training environment: ensures uv, lets you pick how to
# install the Surogate Trainer (3 modes), creates a uv venv, and installs the
# cloud clients (dstack, modal). Pure POSIX sh - works on Linux and macOS.
set -eu

# ---- style -------------------------------------------------------------------
if [ -t 1 ]; then
  GOLD='\033[38;5;220m'; DGOLD='\033[38;5;178m'; PURPLE='\033[38;5;141m'
  GREEN='\033[38;5;114m'; DIM='\033[38;5;243m'; BOLD='\033[1m'; R='\033[0m'
else
  GOLD=''; DGOLD=''; PURPLE=''; GREEN=''; DIM=''; BOLD=''; R=''
fi
say()  { printf "%b\n" "$1"; }
step() { printf "%b\n" "  ${GOLD}▸${R} ${BOLD}$1${R}"; }
ok()   { printf "%b\n" "  ${GREEN}✓${R} $1"; }
info() { printf "%b\n" "  ${DIM}$1${R}"; }
die()  { printf "%b\n" "  ${DGOLD}✗ $1${R}"; exit 1; }

# a tiny spinner while a command runs: spin "label" cmd args...
spin() {
  label="$1"; shift
  if [ ! -t 1 ]; then "$@" >/dev/null 2>&1; return $?; fi
  "$@" >/tmp/.jk_install.log 2>&1 &
  pid=$!
  frames='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
  while kill -0 "$pid" 2>/dev/null; do
    i=$(( (${i:-0} + 1) % 10 ))
    printf "\r  ${GOLD}%s${R} %s" "$(printf '%s' "$frames" | cut -c $((i+1)))" "$label"
    sleep 0.08
  done
  wait "$pid"; rc=$?
  if [ "$rc" -eq 0 ]; then printf "\r  ${GREEN}✓${R} %s\033[K\n" "$label"; else printf "\r  ${DGOLD}✗${R} %s\033[K\n" "$label"; fi
  return $rc
}

ask() { # ask "prompt" -> echoes the line typed on the controlling terminal
  if [ -r /dev/tty ]; then printf "%b" "$1" > /dev/tty; read -r REPLY < /dev/tty; else REPLY=""; fi
  printf '%s' "$REPLY"
}

# ---- banner ------------------------------------------------------------------
clear 2>/dev/null || true
say ""
say "${GOLD}    ◆  Jackalope ${DIM}by${R} ${GOLD}Surogate${R}"
say "${DIM}    Train and fine-tune AI models - one command, then you're rolling.${R}"
say ""

# ---- detect platform ---------------------------------------------------------
OS="$(uname -s 2>/dev/null || echo unknown)"
ARCH="$(uname -m 2>/dev/null || echo unknown)"
case "$OS" in
  Linux)  PLATFORM="Linux" ;;
  Darwin) PLATFORM="macOS" ;;
  *) die "Unsupported OS: $OS. On Windows, run the PowerShell installer (see the README)." ;;
esac
info "Detected ${BOLD}${PLATFORM}${R}${DIM} (${ARCH})"
say ""

# ---- ensure uv ---------------------------------------------------------------
step "Checking for uv (Python toolchain)"
if command -v uv >/dev/null 2>&1; then
  ok "uv $(uv --version 2>/dev/null | awk '{print $2}')"
else
  spin "Installing uv" sh -c 'curl -LsSf https://astral.sh/uv/install.sh | sh' || die "uv install failed"
  # make uv available in this shell
  [ -f "$HOME/.local/bin/env" ] && . "$HOME/.local/bin/env" 2>/dev/null || true
  PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"; export PATH
  command -v uv >/dev/null 2>&1 || die "uv installed but not on PATH - open a new shell and re-run."
fi
say ""

# ---- choose how to install the Surogate Trainer ------------------------------
step "How do you want to run the Surogate Trainer?"
say ""
say "    ${BOLD}1${R}  ${GOLD}Local install${R} ${DIM}(recommended)${R}"
say "       ${DIM}uv venv + a prebuilt CUDA wheel matched to your machine.${R}"
say "    ${BOLD}2${R}  ${GOLD}Docker${R}"
say "       ${DIM}Pull the ready-to-run GPU image. Nothing to compile.${R}"
say "    ${BOLD}3${R}  ${GOLD}From source${R} ${DIM}(contributors)${R}"
say "       ${DIM}Clone the repo and build into a uv venv.${R}"
say ""
choice="$(ask "  ${BOLD}Choose 1-3${R} ${DIM}[1]${R}: ")"
[ -z "$choice" ] && choice=1
say ""

WORKDIR="${SUROGATE_DIR:-$HOME/surogate}"
mkdir -p "$WORKDIR"

case "$choice" in
  2)
    step "Mode: Docker"
    command -v docker >/dev/null 2>&1 || die "Docker not found. Install Docker, then re-run."
    spin "Pulling ghcr.io/invergent-ai/surogate:latest-cu128" docker pull ghcr.io/invergent-ai/surogate:latest-cu128 || die "docker pull failed"
    SUROGATE_HOW="docker run --gpus=all ghcr.io/invergent-ai/surogate:latest-cu128 sft config.yaml"
    ;;
  3)
    step "Mode: From source"
    command -v git >/dev/null 2>&1 || die "git not found."
    if [ ! -d "$WORKDIR/surogate/.git" ]; then
      spin "Cloning invergent-ai/surogate" git clone --depth 1 https://github.com/invergent-ai/surogate "$WORKDIR/surogate" || die "clone failed"
    fi
    spin "Creating uv venv" uv venv "$WORKDIR/surogate/.venv" || die "uv venv failed"
    spin "Installing surogate (editable)" sh -c "cd '$WORKDIR/surogate' && uv pip install --python '$WORKDIR/surogate/.venv' -e ." || die "build failed"
    SUROGATE_HOW="source $WORKDIR/surogate/.venv/bin/activate && surogate sft config.yaml"
    ;;
  *)
    step "Mode: Local install"
    spin "Installing the Surogate Trainer" sh -c "cd '$WORKDIR' && curl -LsSf https://github.com/invergent-ai/surogate/releases/latest/download/install.sh | bash" \
      || die "install failed - see /tmp/.jk_install.log"
    SUROGATE_HOW="cd $WORKDIR && source .venv/bin/activate && surogate sft config.yaml"
    ;;
esac
say ""

# ---- cloud clients -----------------------------------------------------------
step "Installing cloud clients (for SSH / Modal / dstack targets)"
spin "uv tool install modal"          uv tool install modal          || info "modal install skipped"
spin "uv tool install \"dstack[all]\"" uv tool install "dstack[all]"  || info "dstack install skipped"
say ""

# ---- done --------------------------------------------------------------------
say "${GREEN}  ✓ Done.${R} Surogate is ready on ${BOLD}${PLATFORM}${R}."
say ""
say "  ${BOLD}Next${R}"
info "Get the Jackalope desktop app: https://github.com/invergent-ai/surogate-jackalope/releases"
info "Or start a run from the CLI:"
say  "    ${GOLD}${SUROGATE_HOW}${R}"
say ""
say "  ${DIM}Connect cloud:${R} ${GOLD}modal token new${R}${DIM}  ·  ${R}${GOLD}dstack server${R}"
say "  ${DIM}Docs: https://docs.surogate.ai  ·  Multiply yourself: https://surogate.ai${R}"
say ""
