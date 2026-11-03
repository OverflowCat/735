#!/usr/bin/env bash
# Deploy the 735 backend (Rust) + frontend (Vite) to the Xinjiang FRP node.
#
# The node's systemd units are NOT overwritten. 735-backend.service runs
# /opt/735/run-backend.sh (which carries devices.json + all --gamma IPs)
# and 735-frontend.service runs /opt/735/serve.py; serve.py serves /opt/735/dist,
# which is a symlink into /opt/735/releases/. So this script only:
#   * pushes the musl backend binary into /opt/735/bin/backend
#   * pushes the built frontend into a new release dir and swaps the dist symlink
#   * restarts both units
#
# Usage:
#   scripts/d.sh                     # build + deploy both
#   scripts/d.sh --skip-build        # use existing build artifacts
#   scripts/d.sh --backend-only      # backend only
#   scripts/d.sh --frontend-only     # frontend only
#   scripts/d.sh --dry-run           # print commands, do nothing
#
# Env (overrides):
#   SSH_KEY        ssh private key           (default ~/.ssh/sTWPx2n_key)
#   SUDO_PASSWORD  remote sudo password      (default y1234567)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ---- target (see AGENTS.md "远程入口（FRP）") ----
HOST="139.84.136.148"
PORT=19999
USER="yy"
KEY="${SSH_KEY:-$HOME/.ssh/sTWPx2n_key}"
SUDO_PW="${SUDO_PASSWORD:-y1234567}"
REMOTE="/opt/735"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"        # e.g. 20261103T090000Z
RELEASE="deploy-$STAMP"                   # release dir under $REMOTE/releases/

# ---- artifacts ----
MUSL_TARGET="aarch64-unknown-linux-musl"
BACKEND_BIN="$ROOT/backend/target/$MUSL_TARGET/release/backend"
FRONTEND_DIST="$ROOT/cabcal-jurlegi/dist"

SKIP_BUILD=0
BACKEND_ONLY=0
FRONTEND_ONLY=0
DRY=0

for a in "$@"; do
  case "$a" in
    --skip-build) SKIP_BUILD=1 ;;
    --backend-only) BACKEND_ONLY=1 ;;
    --frontend-only) FRONTEND_ONLY=1 ;;
    --dry-run) DRY=1 ;;
    *) echo "unknown option: $a" >&2; exit 2 ;;
  esac
done

ssh_base=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 -p "$PORT" "$USER@$HOST")

log() { printf '[d.sh] %s\n' "$*"; }

run_local() { log "$ $*"; if [ "$DRY" = 1 ]; then return 0; fi; "$@"; }

# run a bash script on the remote, optionally as root (sudo -S)
run_remote() {
  local sudo="$1"; local script="$2"
  log "$ ssh $USER@$HOST  (sudo=$sudo)"
  if [ "$DRY" = 1 ]; then return 0; fi
  local cmd="bash -s"
  if [ "$sudo" = 1 ]; then
    # pipe the password on the REMOTE side so ssh stdin carries only the script
    cmd="printf '%s\n' '$SUDO_PW' | sudo -S bash -s"
  fi
  "${ssh_base[@]}" "$cmd" <<<"$script"
}

build_backend() {
  log "building backend ($MUSL_TARGET, static musl)"
  local cfg="$ROOT/backend/.cargo/config.toml"
  local want='[target.aarch64-unknown-linux-musl]
linker = "aarch64-linux-musl-gcc"
rustflags = ["-C", "target-feature=+crt-static"]
'
  mkdir -p "$ROOT/backend/.cargo"
  if [ ! -f "$cfg" ] || ! grep -q 'crt-static' "$cfg"; then
    printf '%s' "$want" > "$cfg"
  fi
  run_local cargo build --release --target "$MUSL_TARGET" --manifest-path "$ROOT/backend/Cargo.toml"
  if [ ! -x "$BACKEND_BIN" ]; then
    echo "d.sh: missing backend binary: $BACKEND_BIN" >&2; exit 1
  fi
}

build_frontend() {
  log "building frontend (vite)"
  run_local pnpm --dir "$ROOT/cabcal-jurlegi" build
  if [ ! -f "$FRONTEND_DIST/index.html" ]; then
    echo "d.sh: frontend build produced no dist ($FRONTEND_DIST/index.html missing)" >&2; exit 1
  fi
}

push_backend() {
  log "pushing backend binary -> $REMOTE/bin/backend"
  if [ "$DRY" = 1 ]; then return 0; fi
  # push to a .new name then mv over the running binary: scp can't overwrite a
  # running executable ('Text file busy'), but an atomic rename is allowed
  # (the running process keeps the old inode until restart).
  scp -i "$KEY" -P "$PORT" -O "$BACKEND_BIN" "$USER@$HOST:$REMOTE/bin/backend.new"
  run_remote 0 "
set -e
mv -f $REMOTE/bin/backend.new $REMOTE/bin/backend
ls -l $REMOTE/bin/backend
"
}

push_frontend() {
  log "pushing frontend -> $REMOTE/releases/$RELEASE + re-point dist"
  local tarball="$ROOT/frontend-$STAMP.tar.gz"
  if [ "$DRY" = 1 ]; then return 0; fi
  tar -C "$FRONTEND_DIST" -czf "$tarball" .
  scp -i "$KEY" -P "$PORT" -O "$tarball" "$USER@$HOST:$REMOTE/frontend-$STAMP.tar.gz"
  rm -f "$tarball"
  # extract into a fresh release dir, then atomically swap the dist symlink.
  "${ssh_base[@]}" "REMOTE='$REMOTE' STAMP='$STAMP' bash -s" <<'EOF'
set -euo pipefail
release="deploy-$STAMP"
tarball="$REMOTE/frontend-$STAMP.tar.gz"
mkdir -p "$REMOTE/releases/$release"
tar -C "$REMOTE/releases/$release" -xzf "$tarball"
ln -sfn "releases/$release" "$REMOTE/.dist.new"
mv -T "$REMOTE/.dist.new" "$REMOTE/dist"
rm -f "$tarball"
echo "dist -> $REMOTE/releases/$release"
EOF
}

restart() {
  local svc="$1"
  log "restarting $svc"
  run_remote 1 "
set -e
systemctl restart $svc
systemctl --no-pager --full status $svc || true
"
}

verify() {
  log "verifying"
  run_remote 0 "
curl -sf --max-time 15 http://127.0.0.1:3000/api/v1/devices >/dev/null && echo backend_ok
curl -sf --max-time 15 http://127.0.0.1:8080/ >/dev/null && echo frontend_ok
ss -tlnp | grep -E ':3000|:8080' || true
"
}

main() {
  if [ "$BACKEND_ONLY" = 0 ] && [ "$FRONTEND_ONLY" = 0 ]; then
    BACKEND_ONLY=1; FRONTEND_ONLY=1
  fi

  if [ "$SKIP_BUILD" = 0 ]; then
    [ "$BACKEND_ONLY" = 1 ] && build_backend
    [ "$FRONTEND_ONLY" = 1 ] && build_frontend
  else
    log "skip build (--skip-build)"
    [ "$BACKEND_ONLY" = 1 ] && [ ! -x "$BACKEND_BIN" ] && { echo "d.sh: --skip-build but binary missing: $BACKEND_BIN" >&2; exit 1; }
    [ "$FRONTEND_ONLY" = 1 ] && [ ! -f "$FRONTEND_DIST/index.html" ] && { echo "d.sh: --skip-build but dist missing" >&2; exit 1; }
  fi

  echo "target: $USER@$HOST:$PORT -> $REMOTE (release $RELEASE)"
  [ "$BACKEND_ONLY" = 1 ] && push_backend
  [ "$FRONTEND_ONLY" = 1 ] && push_frontend

  [ "$BACKEND_ONLY" = 1 ] && restart 735-backend.service
  [ "$FRONTEND_ONLY" = 1 ] && restart 735-frontend.service

  [ "$DRY" = 1 ] || verify
  log "done"
}

main
