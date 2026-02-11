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
warn()  { echo -e "$(_tty '0;33')!$(_tty 0) ${*}"; }
err()   { echo -e "$(_tty '0;31')✗$(_tty 0) ${*}" >&2; }

CUITE_REPO="${CUITE_REPO:-https://github.com/fentas/cuite.git}"
CUITE_BRANCH="${CUITE_BRANCH:-main}"

# Preflight checks
command -v git &>/dev/null || { err "git is required"; exit 1; }
git rev-parse --is-inside-work-tree &>/dev/null || { err "Run this from inside a git repository"; exit 1; }

# Ensure we're at the project root
cd "$(git rev-parse --show-toplevel)"
info "Installing CUITE into $(pwd)"

# git subtree requires a clean working tree — stash if dirty
STASHED=0
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
  warn "Working tree has modifications — stashing..."
  git stash --include-untracked -q
  STASHED=1
fi

# Clone to temp dir with automatic cleanup
TMPDIR=$(mktemp -d)
cleanup() {
  rm -rf "${TMPDIR}"
  if (( STASHED )); then
    git stash pop -q 2>/dev/null || warn "Could not restore stash — run 'git stash pop' manually"
  fi
}
trap cleanup EXIT

# Redirect stdin from /dev/tty to prevent curl pipe from interfering with git
git clone --depth 1 --branch "${CUITE_BRANCH}" "${CUITE_REPO}" "${TMPDIR}/cuite" </dev/null
"${TMPDIR}/cuite/bin/cuite" init </dev/null

echo ""
ok "CUITE installed successfully"
