# Jackalope by Surogate - one-command setup wizard (Windows).
#
#   irm https://raw.githubusercontent.com/invergent-ai/surogate-jackalope/main/install.ps1 | iex
#
# Ensures uv, lets you pick how to run the Surogate Trainer, and installs the
# cloud clients (dstack, modal). On Windows the engine runs via Docker/WSL or in
# the cloud; native CUDA training is Linux-based.

$ErrorActionPreference = "Stop"
function Step($t) { Write-Host "  > $t" -ForegroundColor Yellow }
function Ok($t)   { Write-Host "  + $t" -ForegroundColor Green }
function Info($t) { Write-Host "  $t" -ForegroundColor DarkGray }

Write-Host ""
Write-Host "    * Jackalope " -ForegroundColor Yellow -NoNewline; Write-Host "by Surogate" -ForegroundColor DarkYellow
Write-Host "    Train and fine-tune AI models - one command to get set up." -ForegroundColor DarkGray
Write-Host ""

# ensure uv
Step "Checking for uv (Python toolchain)"
if (Get-Command uv -ErrorAction SilentlyContinue) {
  Ok ("uv " + (uv --version))
} else {
  Info "Installing uv..."
  irm https://astral.sh/uv/install.ps1 | iex
  $env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
}
Write-Host ""

# choose mode
Step "How do you want to run the Surogate Trainer?"
Write-Host ""
Write-Host "    1  Cloud (recommended)  - run on Modal or your own cloud via dstack" -ForegroundColor Gray
Write-Host "    2  Docker               - pull the GPU image (Docker Desktop / WSL2)" -ForegroundColor Gray
Write-Host "    3  WSL                  - install the Linux engine inside WSL" -ForegroundColor Gray
Write-Host ""
$choice = Read-Host "  Choose 1-3 [1]"
if ([string]::IsNullOrWhiteSpace($choice)) { $choice = "1" }
Write-Host ""

switch ($choice) {
  "2" {
    Step "Mode: Docker"
    if (Get-Command docker -ErrorAction SilentlyContinue) {
      Info "Pulling ghcr.io/invergent-ai/surogate:latest-cu128 ..."
      docker pull ghcr.io/invergent-ai/surogate:latest-cu128
      Ok "Image ready."
    } else { Info "Docker not found - install Docker Desktop, then: docker pull ghcr.io/invergent-ai/surogate:latest-cu128" }
  }
  "3" {
    Step "Mode: WSL"
    if (Get-Command wsl -ErrorAction SilentlyContinue) {
      Info "Installing the engine inside WSL..."
      wsl bash -lc "curl -LsSf https://github.com/invergent-ai/surogate-jackalope/main/install.sh | sh"
    } else { Info "WSL not found - enable it with: wsl --install, then re-run inside WSL." }
  }
  default {
    Step "Mode: Cloud"
    Info "You'll train on Modal or dstack. Installing the clients below."
  }
}
Write-Host ""

# cloud clients
Step "Installing cloud clients (Modal, dstack)"
try { uv tool install modal } catch { Info "modal install skipped" }
try { uv tool install "dstack[all]" } catch { Info "dstack install skipped" }
Write-Host ""

Ok "Done. Surogate is set up."
Write-Host ""
Write-Host "  Next" -ForegroundColor White
Info "Get the Jackalope desktop app: https://github.com/invergent-ai/surogate-jackalope/releases"
Info "Connect cloud:  modal token new   ·   dstack server"
Info "Docs: https://docs.surogate.ai   ·   Multiply yourself: https://surogate.ai"
Write-Host ""
