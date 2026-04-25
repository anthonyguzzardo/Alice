#!/bin/bash
# Builds the Rust signal engine. Called automatically by npm run dev/build.
# Installs Rust toolchain if missing. Skips rebuild if source hasn't changed.

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_FILE="$DIR/alice-signals.darwin-arm64.node"

# ── Install Rust if missing ─────────────────────────────────────────

if ! command -v cargo &>/dev/null; then
  if [ -f "$HOME/.cargo/env" ]; then
    source "$HOME/.cargo/env"
  fi
fi

if ! command -v cargo &>/dev/null; then
  echo "[signals] Installing Rust toolchain..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y 2>&1
  source "$HOME/.cargo/env"
fi

# ── Skip if nothing changed ─────────────────────────────────────────

HASH_FILE="$DIR/target/.source-hash"
CURRENT_HASH=$(find "$DIR/src" "$DIR/Cargo.toml" -type f 2>/dev/null | sort | xargs cat | shasum -a 256 | cut -d' ' -f1)

if [ -f "$NODE_FILE" ] && [ -f "$HASH_FILE" ]; then
  PREV_HASH=$(cat "$HASH_FILE")
  if [ "$CURRENT_HASH" = "$PREV_HASH" ]; then
    echo "[signals] Rust engine up to date, skipping build"
    exit 0
  fi
fi

# ── Build ────────────────────────────────────────────────────────────

echo "[signals] Building Rust signal engine..."
cd "$DIR"

# Generate type-def temp file via napi-derive's `type-def` feature.
# `cargo build` here is just to trigger the type-def emission; the actual
# .node binary is produced by `napi build` below.
TYPE_DEF_TMP="$DIR/target/.napi_type_def.tmp"
rm -f "$TYPE_DEF_TMP"
TYPE_DEF_TMP_PATH="$TYPE_DEF_TMP" cargo build --release 2>&1

# Build the .node binary and the JS binding wrapper.
npx napi build --release --platform 2>&1

# Stitch the type-def temp file into a clean index.d.ts.
# This makes the Rust #[napi] annotations the single source of truth for
# the TypeScript bindings — no hand-written interface drift.
node "$DIR/scripts/generate-dts.mjs" "$TYPE_DEF_TMP" "$DIR/index.d.ts"

mkdir -p "$DIR/target"
echo "$CURRENT_HASH" > "$HASH_FILE"
echo "[signals] Rust engine built successfully"
