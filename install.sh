#!/usr/bin/env bash
set -eu -o pipefail

# CUITE — The Claude sUITE Framework
# https://cuite.quest
#
# Usage:
#   curl -fsSL https://cuite.quest/install.sh | bash
#   wget -qO- https://cuite.quest/install.sh | bash
#
# Environment variables:
#   CUITE_REPO   — git URL to clone (default: https://github.com/fentas/cuite.git)
#   CUITE_BRANCH — branch to use   (default: main)

_tty() { [[ -t 1 ]] && printf '\033[%sm' "${1}" || true; }
info()  { echo -e "$(_tty '0;34')→$(_tty 0) ${*}"; }
ok()    { echo -e "$(_tty '0;32')✓$(_tty 0) ${*}"; }
err()   { echo -e "$(_tty '0;31')✗$(_tty 0) ${*}" >&2; }

CUITE_REPO="${CUITE_REPO:-https://github.com/fentas/cuite.git}"
CUITE_BRANCH="${CUITE_BRANCH:-main}"

# Preflight checks
command -v git &>/dev/null || { err "git is required"; exit 1; }
git rev-parse --is-inside-work-tree &>/dev/null || { err "Run this from inside a git repository"; exit 1; }

# Ensure we're at the project root
cd "$(git rev-parse --show-toplevel)"
info "Installing CUITE into $(pwd)"

# Clone to temp dir with automatic cleanup
TMPDIR=$(mktemp -d)
trap 'rm -rf "${TMPDIR}"' EXIT

git clone --depth 1 --branch "${CUITE_BRANCH}" "${CUITE_REPO}" "${TMPDIR}/cuite"
"${TMPDIR}/cuite/bin/cuite" init

echo ""
ok "CUITE installed successfully"
