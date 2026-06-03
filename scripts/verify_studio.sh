#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[1/8] Checking environment..."
bash "$ROOT_DIR/check-setup.sh"

echo "[2/8] Linting Studio frontend..."
(cd "$ROOT_DIR" && npm run lint)

echo "[3/8] Building Studio frontend..."
(cd "$ROOT_DIR" && npm run build)

echo "[4/8] Running Tauri backend tests..."
(cd "$ROOT_DIR/src-tauri" && cargo test)

echo "[5/8] Running planner flow tests..."
(cd "$ROOT_DIR" && npm run test:planner-flow)

echo "[6/8] Running node availability tests..."
(cd "$ROOT_DIR" && npm run test:node-availability)

echo "[7/8] Running flow runtime preflight tests..."
(cd "$ROOT_DIR" && npm run test:flow-runtime)

echo "[8/8] Running node-template compile smoke test..."
(cd "$ROOT_DIR" && npm run smoke:compile:nodes)

echo "Studio verification passed."
