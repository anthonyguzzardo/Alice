#!/usr/bin/env bash
set -euo pipefail

# Reproducibility check: build the Rust crate twice from clean state,
# compute signals on a fixture session, and verify bit-identical output.
#
# This catches:
# - Summation order sensitivity (fixed by Neumaier)
# - HashMap iteration nondeterminism (fixed by BTreeMap)
# - FMA contraction variance (fixed by toolchain pinning)
# - Any other source of floating-point nondeterminism
#
# Usage: ./src-rs/reproducibility-check.sh
#   or:  npm run reproducibility-check

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

SNAP_A=$(mktemp -d)
SNAP_B=$(mktemp -d)
trap 'rm -rf "$SNAP_A" "$SNAP_B"' EXIT

echo "=== Build A ==="
cargo clean 2>/dev/null || true
cargo build --release 2>&1 | tail -1
REPRO_SNAPSHOT_DIR="$SNAP_A" cargo test --release --test reproducibility 2>&1 | grep -E "^test|Snapshot"

echo ""
echo "=== Build B (clean rebuild) ==="
cargo clean
cargo build --release 2>&1 | tail -1
REPRO_SNAPSHOT_DIR="$SNAP_B" cargo test --release --test reproducibility 2>&1 | grep -E "^test|Snapshot"

echo ""
echo "=== Comparing snapshots ==="

PASS=true
for f in dynamical.json motor.json; do
    if [ -f "$SNAP_A/$f" ] && [ -f "$SNAP_B/$f" ]; then
        if diff -q "$SNAP_A/$f" "$SNAP_B/$f" > /dev/null 2>&1; then
            echo "  $f: IDENTICAL"
        else
            echo "  $f: DIVERGED"
            echo "    Build A: $(cat "$SNAP_A/$f" | head -c 200)..."
            echo "    Build B: $(cat "$SNAP_B/$f" | head -c 200)..."
            diff "$SNAP_A/$f" "$SNAP_B/$f" || true
            PASS=false
        fi
    else
        echo "  $f: MISSING (snapshot not written)"
        PASS=false
    fi
done

echo ""
if $PASS; then
    echo "PASS: All signals are bit-identical across clean rebuilds."
    exit 0
else
    echo "FAIL: Signal outputs diverged between builds."
    echo "This means floating-point results depend on compilation nondeterminism."
    echo "Check: Neumaier summation coverage, BTreeMap for iteration-order-dependent sums,"
    echo "       toolchain pinning in rust-toolchain.toml."
    exit 1
fi
