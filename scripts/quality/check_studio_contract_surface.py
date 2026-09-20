#!/usr/bin/env python3
# Copyright (c) 2026 Skuld, LLC. All rights reserved.
# Proprietary and confidential. Reverse engineering prohibited.
"""Studio contract surface integrity gate.

This gate covers Studio's desktop-specific surface:
- TS/TSX `invoke("command")` calls must target commands registered in the
  Tauri `generate_handler!` list.
- Productive calls to the Orchestrator API must match the vendored backend
  contract.
- Legacy `/api/licenses/validate` and hardcoded debug HTTP beacons are blocked.

External provider traffic (OpenAI, Anthropic, Ollama, MCP servers, Graph, etc.)
is reported in the manifest but is not checked against the Orchestrator
contract because those are user-configured/provider contracts.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
TAURI_SRC = ROOT / "src-tauri" / "src"
MAIN_RS = TAURI_SRC / "main.rs"
CONTRACT = ROOT / "contracts" / "orchestrator-api-contract.json"
OUTPUT = ROOT / "studio-contract-surface-manifest.json"

HTTP_METHODS = {"GET", "POST", "PATCH", "PUT", "DELETE"}
METHOD_RE = re.compile(r"method\s*:\s*['\"]([A-Za-z]+)['\"]")


def strip_comments(source: str) -> str:
    out: list[str] = []
    i = 0
    n = len(source)
    quote: str | None = None
    while i < n:
        ch = source[i]
        nxt = source[i + 1] if i + 1 < n else ""
        if quote:
            out.append(ch)
            if ch == "\\" and i + 1 < n:
                out.append(nxt)
                i += 2
                continue
            if ch == quote:
                quote = None
            i += 1
            continue
        if ch in "'\"`":
            quote = ch
            out.append(ch)
            i += 1
            continue
        if ch == "/" and nxt == "/":
            while i < n and source[i] != "\n":
                i += 1
            continue
        if ch == "/" and nxt == "*":
            i += 2
            while i < n and not (source[i] == "*" and i + 1 < n and source[i + 1] == "/"):
                if source[i] == "\n":
                    out.append("\n")
                i += 1
            i += 2
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def source_files(base: Path, suffixes: set[str]) -> list[Path]:
    excluded_dirs = {"node_modules", "dist", "target", ".git"}
    return sorted(
        path
        for path in base.rglob("*")
        if path.suffix in suffixes
        and not path.name.endswith(".d.ts")
        and not any(part in excluded_dirs for part in path.parts)
        and not path.name.endswith(".spec.ts")
        and not path.name.endswith(".test.ts")
        and not path.name.endswith(".test.tsx")
    )


def line_of(source: str, index: int) -> int:
    return source.count("\n", 0, index) + 1


def read_call_args(source: str, open_paren: int) -> tuple[str, int]:
    i = open_paren + 1
    start = i
    n = len(source)
    ctx: list[str] = ["code"]
    paren = 1
    while i < n:
        ch = source[i]
        top = ctx[-1]
        if top in ("'", '"'):
            if ch == "\\":
                i += 2
                continue
            if ch == top:
                ctx.pop()
            i += 1
            continue
        if top == "`":
            if ch == "\\":
                i += 2
                continue
            if ch == "`":
                ctx.pop()
            elif ch == "$" and i + 1 < n and source[i + 1] == "{":
                ctx.append("code")
                i += 2
                continue
            i += 1
            continue
        if ch in "'\"`":
            ctx.append(ch)
            i += 1
            continue
        if ch == "{":
            ctx.append("code")
            i += 1
            continue
        if ch == "}":
            if len(ctx) > 1:
                ctx.pop()
            i += 1
            continue
        if ch == "(":
            paren += 1
        elif ch == ")":
            paren -= 1
            if paren == 0:
                return source[start:i], i + 1
        i += 1
    return source[start:], n


def first_argument(args: str) -> tuple[str, str | None]:
    i = 0
    n = len(args)
    while i < n and args[i] in " \t\n\r":
        i += 1
    if i >= n:
        return "none", None
    quote = args[i]
    if quote not in "'\"`":
        return "dynamic", None
    j = i + 1
    buf: list[str] = []
    while j < n:
        ch = args[j]
        if ch == "\\":
            buf.append(args[j : j + 2])
            j += 2
            continue
        if quote == "`" and ch == "$" and j + 1 < n and args[j + 1] == "{":
            buf.append("${")
            j += 2
            depth = 1
            while j < n and depth > 0:
                if args[j] == "{":
                    depth += 1
                elif args[j] == "}":
                    depth -= 1
                if depth > 0:
                    buf.append(args[j])
                j += 1
            buf.append("}")
            continue
        if ch == quote:
            return "literal", "".join(buf)
        buf.append(ch)
        j += 1
    return "literal", "".join(buf)


def normalize_segment(seg: str) -> str | None:
    fragment = seg.find("${")
    if fragment == 0:
        return "{}"
    if fragment > 0:
        seg = seg[:fragment]
    seg = seg.split("?", 1)[0]
    if seg == "":
        return None
    if seg.startswith(":") or (seg.startswith("{") and seg.endswith("}")):
        return "{}"
    return seg


def normalize_path(raw: str) -> str:
    path = raw.split("#", 1)[0]
    segments = [
        token
        for seg in path.split("/")
        if seg
        for token in [normalize_segment(seg)]
        if token is not None
    ]
    return "/" + "/".join(segments)


def command_name(raw: str) -> str:
    return raw.split("::")[-1].strip()


def registered_tauri_commands() -> list[dict[str, object]]:
    source = strip_comments(MAIN_RS.read_text())
    start = source.find("tauri::generate_handler![")
    if start < 0:
        return []
    open_idx = source.find("[", start)
    depth = 1
    i = open_idx + 1
    content_start = i
    while i < len(source) and depth > 0:
        if source[i] == "[":
            depth += 1
        elif source[i] == "]":
            depth -= 1
            if depth == 0:
                content = source[content_start:i]
                break
        i += 1
    else:
        return []

    commands: list[dict[str, object]] = []
    for item in content.split(","):
        value = item.strip()
        if not value:
            continue
        commands.append(
            {
                "command": command_name(value),
                "source": str(MAIN_RS.relative_to(ROOT)),
            }
        )
    commands.sort(key=lambda c: str(c["command"]))
    return commands


def tauri_invocations() -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    calls: list[dict[str, object]] = []
    unresolved: list[dict[str, object]] = []
    for path in source_files(SRC, {".ts", ".tsx"}):
        source = strip_comments(path.read_text())
        rel = str(path.relative_to(ROOT))
        for match in re.finditer(r"\binvoke\s*(?:<[^>]+>)?\s*\(", source):
            open_paren = source.find("(", match.start())
            args, _ = read_call_args(source, open_paren)
            kind, literal = first_argument(args)
            line = line_of(source, match.start())
            if kind != "literal" or not literal:
                unresolved.append({"caller": "invoke", "source": rel, "line": line})
                continue
            calls.append(
                {
                    "command": literal,
                    "source": rel,
                    "line": line,
                }
            )
    calls.sort(key=lambda c: (str(c["command"]), str(c["source"]), int(c["line"])))
    unresolved.sort(key=lambda c: (str(c["source"]), int(c["line"])))
    return calls, unresolved


def contract_index() -> set[tuple[str, str]]:
    contract = json.loads(CONTRACT.read_text())
    return {
        (str(route["method"]).upper(), normalize_path(str(route["path"])))
        for route in contract["routes"]
    }


def orchestrator_api_candidates() -> list[dict[str, object]]:
    candidates: list[dict[str, object]] = []
    for path in source_files(TAURI_SRC, {".rs"}):
        source = strip_comments(path.read_text())
        rel = str(path.relative_to(ROOT))
        lines = source.splitlines()
        for index, line in enumerate(lines, start=1):
            if "/api/" not in line:
                continue
            window = "\n".join(lines[max(0, index - 20) : min(len(lines), index + 5)])
            if "SKULDBOT_ORCHESTRATOR_URL" not in window:
                continue
            method = "POST" if ".post" in window or ".post" in line else "GET"
            match = re.search(r"/api/[A-Za-z0-9_./:${}-]+", line)
            if not match:
                candidates.append(
                    {
                        "method": method,
                        "path": None,
                        "source": rel,
                        "line": index,
                        "unresolved": True,
                    }
                )
                continue
            endpoint = match.group(0).rstrip('",);')
            candidates.append(
                {
                    "method": method,
                    "path": endpoint,
                    "normalizedPath": normalize_path(endpoint),
                    "source": rel,
                    "line": index,
                    "unresolved": False,
                }
            )
    candidates.sort(key=lambda c: (str(c["source"]), int(c["line"])))
    return candidates


def raw_fetch_calls() -> list[dict[str, object]]:
    calls: list[dict[str, object]] = []
    for path in source_files(SRC, {".ts", ".tsx"}):
        source = strip_comments(path.read_text())
        rel = str(path.relative_to(ROOT))
        for match in re.finditer(r"(?<![\w.])fetch\s*\(", source):
            open_paren = source.find("(", match.start())
            args, _ = read_call_args(source, open_paren)
            kind, literal = first_argument(args)
            calls.append(
                {
                    "source": rel,
                    "line": line_of(source, match.start()),
                    "literal": literal if kind == "literal" else None,
                    "dynamic": kind != "literal",
                }
            )
    return calls


def build_manifest() -> dict[str, object]:
    contract = json.loads(CONTRACT.read_text()) if CONTRACT.exists() else {}
    registered = registered_tauri_commands()
    invokes, unresolved = tauri_invocations()
    remote = orchestrator_api_candidates()
    fetches = raw_fetch_calls()
    return {
        "schemaVersion": 1,
        "service": "skuldbot-studio",
        "contractSource": {
            "service": contract.get("service"),
            "routeCount": contract.get("routeCount"),
        },
        "registeredCommandCount": len(registered),
        "tauriInvokeCount": len(invokes),
        "unresolvedInvokeCount": len(unresolved),
        "orchestratorApiCandidateCount": len(remote),
        "rawFetchCount": len(fetches),
        "registeredCommands": registered,
        "tauriInvokes": invokes,
        "unresolvedInvokes": unresolved,
        "orchestratorApiCandidates": remote,
        "rawFetches": fetches,
    }


def manifest_json(manifest: dict[str, object]) -> str:
    return json.dumps(manifest, indent=2, sort_keys=True) + "\n"


def run_check() -> int:
    if not CONTRACT.exists():
        print(f"Missing vendored contract: {CONTRACT.relative_to(ROOT)}")
        return 1

    manifest = build_manifest()
    expected = manifest_json(manifest)
    errors: list[str] = []

    if not OUTPUT.exists():
        errors.append(f"{OUTPUT.relative_to(ROOT)} missing. Run npm run generate:studio-contract-surface.")
    elif OUTPUT.read_text() != expected:
        errors.append(f"{OUTPUT.relative_to(ROOT)} stale. Run npm run generate:studio-contract-surface.")

    registered = {str(item["command"]) for item in manifest["registeredCommands"]}
    for call in manifest["tauriInvokes"]:
        if str(call["command"]) not in registered:
            errors.append(
                f"UNREGISTERED TAURI COMMAND: {call['command']} at "
                f"{call['source']}:{call['line']}"
            )

    for call in manifest["unresolvedInvokes"]:
        errors.append(
            f"UNRESOLVED TAURI INVOKE: {call['source']}:{call['line']} "
            "- command name is not a literal."
        )

    method_path = contract_index()
    for call in manifest["orchestratorApiCandidates"]:
        if call.get("unresolved"):
            errors.append(
                f"UNRESOLVED ORCHESTRATOR API ROUTE: {call['source']}:{call['line']}"
            )
            continue
        key = (str(call["method"]).upper(), str(call["normalizedPath"]))
        if key not in method_path:
            errors.append(
                f"ORPHAN ORCHESTRATOR API ROUTE: {call['method']} {call['path']} "
                f"at {call['source']}:{call['line']}"
            )

    repo_text = "\n".join(
        path.read_text(errors="ignore")
        for base, suffixes in ((SRC, {".ts", ".tsx"}), (TAURI_SRC, {".rs"}))
        for path in source_files(base, suffixes)
    )
    if "/api/licenses/validate" in repo_text:
        errors.append("LEGACY API ROUTE: /api/licenses/validate is forbidden in Studio.")

    for call in manifest["rawFetches"]:
        literal = call.get("literal")
        if literal and str(literal).startswith(("http://", "https://")):
            errors.append(
                f"HARDCODED RAW FETCH: {literal} at {call['source']}:{call['line']}"
            )

    if errors:
        print("Studio contract surface integrity gate FAILED.")
        print()
        for err in errors:
            print(f"- {err}")
        print()
        return 1

    print(
        "Studio contract surface integrity gate passed "
        f"({manifest['tauriInvokeCount']} Tauri invokes, "
        f"{manifest['registeredCommandCount']} registered commands, "
        f"{manifest['orchestratorApiCandidateCount']} Orchestrator API candidates)."
    )
    return 0


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="(re)generate the manifest")
    args = parser.parse_args(list(argv) if argv is not None else None)

    if args.write:
        manifest = build_manifest()
        OUTPUT.write_text(manifest_json(manifest))
        print(f"Wrote {OUTPUT.relative_to(ROOT)} ({manifest['tauriInvokeCount']} Tauri invokes).")
        return 0

    return run_check()


if __name__ == "__main__":
    sys.exit(main())
