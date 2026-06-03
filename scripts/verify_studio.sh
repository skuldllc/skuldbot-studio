#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[1/7] Checking environment..."
bash "$ROOT_DIR/check-setup.sh"

echo "[2/7] Linting Studio frontend..."
(cd "$ROOT_DIR" && npm run lint)

echo "[3/7] Building Studio frontend..."
(cd "$ROOT_DIR" && npm run build)

echo "[4/7] Running Tauri backend tests..."
(cd "$ROOT_DIR/src-tauri" && cargo test)

echo "[5/7] Running planner flow tests..."
(cd "$ROOT_DIR" && npm run test:planner-flow)

echo "[6/7] Running node availability tests..."
(cd "$ROOT_DIR" && npm run test:node-availability)

echo "[7/7] Running node-template compile smoke test..."
(cd "$ROOT_DIR" && npm run smoke:compile:nodes)

echo "Studio verification passed."
