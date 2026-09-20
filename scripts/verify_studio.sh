#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[1/9] Checking environment..."
bash "$ROOT_DIR/check-setup.sh"

echo "[2/9] Linting Studio frontend..."
(cd "$ROOT_DIR" && npm run lint)

echo "[3/9] Building Studio frontend..."
(cd "$ROOT_DIR" && npm run build)

echo "[4/9] Running Tauri backend tests..."
(cd "$ROOT_DIR/src-tauri" && cargo test)

echo "[5/9] Running planner flow tests..."
(cd "$ROOT_DIR" && npm run test:planner-flow)

echo "[6/9] Running catalog contract tests..."
(cd "$ROOT_DIR" && npm run test:catalog-contract)

echo "[7/9] Running node availability tests..."
(cd "$ROOT_DIR" && npm run test:node-availability)

echo "[8/9] Running flow runtime preflight tests..."
(cd "$ROOT_DIR" && npm run test:flow-runtime)

echo "[9/9] Running node-template compile smoke test..."
(cd "$ROOT_DIR" && npm run smoke:compile:nodes)

echo "Studio verification passed."
