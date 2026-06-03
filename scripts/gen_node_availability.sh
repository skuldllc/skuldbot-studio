#!/usr/bin/env bash
# Copyright (c) 2026 Skuld, LLC. All rights reserved.
# Proprietary and confidential. Reverse engineering prohibited.
#
# Regenerates src/data/nodeAvailability.json — the single source of truth the
# Studio uses to decide which nodes are executable. It is produced by QG19's
# parity checker in the sibling skuldbot-documentation repo, comparing the Studio
# catalog against the compiler templates and the executor registry.
#
# Requires the sibling repos checked out next to skuldbot-studio:
#   skuldbot-documentation, skuldbot-compiler, skuldbot-executor
#
# The checker exits non-zero whenever the catalog still contains non-executable
# nodes (the normal state today). That exit code reports parity, not a generation
# failure, so we ignore it and instead verify the manifest was actually written.

set -u

STUDIO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${STUDIO_DIR}/src/data/nodeAvailability.json"
CHECKER="${STUDIO_DIR}/../skuldbot-documentation/scripts/quality/check_node_parity.py"

if [ ! -f "${CHECKER}" ]; then
  echo "ERROR: parity checker not found at ${CHECKER}" >&2
  echo "Check out skuldbot-documentation next to skuldbot-studio." >&2
  exit 1
fi

python3 "${CHECKER}" \
  --studio-dir "${STUDIO_DIR}" \
  --compiler-dir "${STUDIO_DIR}/../skuldbot-compiler/python" \
  --executor-dir "${STUDIO_DIR}/../skuldbot-executor/python" \
  --availability-json "${OUT}" || true

if [ ! -s "${OUT}" ]; then
  echo "ERROR: ${OUT} was not generated" >&2
  exit 1
fi

echo "Wrote ${OUT}"
