// Copyright (c) 2026 Skuld, LLC. All rights reserved.
// Proprietary and confidential. Reverse engineering prohibited.

import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const GRAPHICAL_RUNTIME_BLOCKED = new Set([
  "desktop.open_app",
  "desktop.click",
  "desktop.type_text",
  "desktop.hotkey",
  "desktop.get_window",
  "desktop.minimize",
  "desktop.maximize",
  "desktop.close_window",
  "desktop.screenshot",
  "desktop.image_click",
  "desktop.wait_image",
  "desktop.clipboard_copy",
  "document.ocr",
  "document.pdf_to_image",
  "ai.vision",
  "logging.screenshot",
]);

export function resolveRepoPaths(rootDir) {
  const workspaceDir = path.resolve(rootDir, "..");
  return {
    rootDir,
    workspaceDir,
    studioDir: rootDir,
    compilerDir:
      process.env.SKULDBOT_COMPILER_PYTHON_PATH ||
      path.join(workspaceDir, "skuldbot-compiler", "python"),
    executorDir:
      process.env.SKULDBOT_EXECUTOR_PYTHON_PATH ||
      path.join(workspaceDir, "skuldbot-executor", "python"),
  };
}

export function readStudioTemplates(studioDir) {
  const nodeTemplatesPath = path.join(studioDir, "src", "data", "nodeTemplates.ts");
  const src = readFileSync(nodeTemplatesPath, "utf8");
  const templates = [];
  const objectPattern = /\n  \{\n    type:\s*"([^"]+)"([\s\S]*?)\n  \},/g;
  let match;
  while ((match = objectPattern.exec(src)) !== null) {
    const [, type, body] = match;
    templates.push({
      type,
      category: stringProperty(body, "category") || type.split(".")[0],
      label: stringProperty(body, "label") || type,
      description: stringProperty(body, "description") || "",
      icon: stringProperty(body, "icon") || null,
      defaultConfig: {},
      configSchema: schemaFields(section(body, "configSchema")),
      outputSchema: schemaFields(section(body, "outputSchema")),
    });
  }
  if (templates.length === 0) {
    throw new Error("Failed to read nodeTemplates array");
  }
  return templates;
}

function stringProperty(text, key) {
  const pattern = new RegExp(String.raw`${key}:\s*"([^"]*)"`);
  return pattern.exec(text)?.[1] || null;
}

function section(text, key) {
  const start = text.indexOf(`${key}:`);
  if (start === -1) {
    return "";
  }
  const after = text.slice(start);
  const nextTopLevel = after.search(/\n    [a-zA-Z][a-zA-Z0-9_]*:/);
  return nextTopLevel === -1 ? after : after.slice(0, nextTopLevel);
}

function schemaFields(text) {
  const fields = [];
  const fieldPattern = /\{\s*name:\s*"([^"]+)"([\s\S]*?)\}/g;
  let match;
  while ((match = fieldPattern.exec(text)) !== null) {
    const [, name, body] = match;
    fields.push({
      name,
      label: stringProperty(body, "label"),
      type: stringProperty(body, "type"),
      required: /\brequired:\s*true\b/.test(body),
    });
  }
  return fields;
}

export function readCompilerNodeTypes(compilerDir, studioNodeTypes) {
  const templateDir = path.join(compilerDir, "skuldbot_compiler", "compiler", "templates");
  const script = `
import json
import pathlib
import re
import sys

template_dir = pathlib.Path(${JSON.stringify(templateDir)})
studio_nodes = set(json.loads(${JSON.stringify(JSON.stringify([...studioNodeTypes].sort()))}))
if not template_dir.is_dir():
    raise SystemExit(f"Compiler templates not found: {template_dir}")

exact_pattern = re.compile(r"node\\.type\\s*==\\s*['\\\"]([^'\\\"]+)['\\\"]")
prefix_pattern = re.compile(r"node\\.type\\.startswith\\(\\s*['\\\"]([^'\\\"]+)['\\\"]\\s*\\)")
node_types = set()
for template_path in sorted(template_dir.glob("*.j2")):
    text = template_path.read_text(encoding="utf-8")
    node_types.update(exact_pattern.findall(text))
    for prefix in prefix_pattern.findall(text):
        node_types.update(node_type for node_type in studio_nodes if node_type.startswith(prefix))

print(json.dumps(sorted(node_types)))
`;
  const result = spawnSync("python3", ["-c", script], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Failed to read compiler node mappings");
  }
  return new Set(JSON.parse(result.stdout));
}

export function readExecutorNodes(executorDir) {
  const registryPath = path.join(executorDir, "skuldbot", "nodes", "registry.py");
  const script = `
import importlib.util
import json
import pathlib

registry_path = pathlib.Path(${JSON.stringify(registryPath)})
if not registry_path.is_file():
    raise SystemExit(f"Executor registry not found: {registry_path}")

spec = importlib.util.spec_from_file_location("skuldbot_executor_node_registry", registry_path)
if spec is None or spec.loader is None:
    raise SystemExit(f"Could not load executor registry: {registry_path}")

module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
registry = getattr(module, "NODE_REGISTRY", None)
if not isinstance(registry, dict):
    raise SystemExit(f"NODE_REGISTRY not found in: {registry_path}")

payload = {}
for node_type, mapping in registry.items():
    payload[str(node_type)] = {
        "nodeType": str(node_type),
        "category": getattr(getattr(mapping, "category", None), "value", str(getattr(mapping, "category", ""))),
        "description": str(getattr(mapping, "description", "")),
        "keyword": str(getattr(mapping, "keyword", "")),
        "library": str(getattr(getattr(mapping, "library", None), "name", "")),
        "configMapping": dict(getattr(mapping, "config_mapping", {}) or {}),
        "hasReturnVariable": getattr(mapping, "return_variable", None) is not None,
    }

print(json.dumps(payload, sort_keys=True))
`;
  const result = spawnSync("python3", ["-c", script], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Failed to read executor node registry");
  }
  return JSON.parse(result.stdout);
}

function normalizeSchema(schema) {
  if (!Array.isArray(schema)) {
    return [];
  }
  return schema.map((field) => {
    const normalized = { ...field };
    if (Array.isArray(normalized.options)) {
      normalized.options = normalized.options.map((option) => ({ ...option }));
    }
    return normalized;
  });
}

function statusFor({ studioVisible, hasCompilerMapping, hasExecutorMapping, runtimeBlocked }) {
  if (!studioVisible) {
    return "engine_hidden";
  }
  if (runtimeBlocked) {
    return "runtime_blocked";
  }
  if (hasCompilerMapping && hasExecutorMapping) {
    return "executable";
  }
  return "not_implemented";
}

export function buildCatalogContract(rootDir) {
  const paths = resolveRepoPaths(rootDir);
  const templates = readStudioTemplates(paths.studioDir);
  const studioByType = new Map(templates.map((template) => [template.type, template]));
  const studioNodeTypes = new Set(studioByType.keys());
  const compilerNodeTypes = readCompilerNodeTypes(paths.compilerDir, studioNodeTypes);
  const executorNodes = readExecutorNodes(paths.executorDir);
  const executorNodeTypes = new Set(Object.keys(executorNodes));
  const allNodeTypes = new Set([
    ...studioNodeTypes,
    ...compilerNodeTypes,
    ...executorNodeTypes,
  ]);

  const nodes = {};
  for (const nodeType of [...allNodeTypes].sort()) {
    const studio = studioByType.get(nodeType);
    const executor = executorNodes[nodeType];
    const studioVisible = Boolean(studio);
    const hasCompilerMapping = compilerNodeTypes.has(nodeType);
    const hasExecutorMapping = executorNodeTypes.has(nodeType);
    const runtimeBlocked = GRAPHICAL_RUNTIME_BLOCKED.has(nodeType);
    const status = statusFor({
      studioVisible,
      hasCompilerMapping,
      hasExecutorMapping,
      runtimeBlocked,
    });

    const reasons = [];
    if (!studioVisible) reasons.push("not_visible_in_studio");
    if (runtimeBlocked) reasons.push("requires_graphical_runtime");
    if (!hasCompilerMapping) reasons.push("missing_compiler_mapping");
    if (!hasExecutorMapping) reasons.push("missing_executor_mapping");

    nodes[nodeType] = {
      nodeType,
      category: studio?.category || executor?.category || nodeType.split(".")[0],
      label: studio?.label || nodeType,
      description: studio?.description || executor?.description || "",
      status,
      plannerEligible: status === "executable",
      studioVisible,
      hasCompilerMapping,
      hasExecutorMapping,
      runtimeBlocked,
      reasons,
      studio: studio
        ? {
            icon: studio.icon || null,
            defaultConfig: studio.defaultConfig || {},
            configSchema: normalizeSchema(studio.configSchema),
            outputSchema: normalizeSchema(studio.outputSchema),
          }
        : null,
      executor: executor || null,
    };
  }

  const values = Object.values(nodes);
  const summary = {
    totalNodes: values.length,
    studioVisibleCount: values.filter((node) => node.studioVisible).length,
    compilerMappingCount: values.filter((node) => node.hasCompilerMapping).length,
    executorMappingCount: values.filter((node) => node.hasExecutorMapping).length,
    executableCount: values.filter((node) => node.status === "executable").length,
    runtimeBlockedCount: values.filter((node) => node.status === "runtime_blocked").length,
    notImplementedCount: values.filter((node) => node.status === "not_implemented").length,
    engineHiddenCount: values.filter((node) => node.status === "engine_hidden").length,
  };

  return {
    schemaVersion: "1.0.0",
    generatedBy: "studio-catalog-contract",
    sources: {
      studio: "src/data/nodeTemplates.ts",
      compiler: "skuldbot-compiler/python/skuldbot_compiler/compiler/templates/*.j2",
      executor: "skuldbot-executor/python/skuldbot/nodes/registry.py",
    },
    statuses: {
      executable: "Visible in Studio and backed by compiler + executor.",
      runtime_blocked: "Visible in Studio but blocked until the required runtime capability exists.",
      not_implemented: "Visible in Studio but missing compiler or executor support.",
      engine_hidden: "Backed by compiler or executor but not visible in Studio.",
    },
    summary,
    nodes,
  };
}
