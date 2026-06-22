export type OpcPartPath = string;

export function normalizeOpcPartPath(partPath: string): OpcPartPath {
  const withoutHash = partPath.split("#", 1)[0] ?? "";
  const raw = withoutHash.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts: string[] = [];

  for (const part of raw.split("/")) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === "..") {
      if (parts.length === 0) {
        throw new Error(`OPC part path escapes package root: ${partPath}`);
      }
      parts.pop();
      continue;
    }
    parts.push(part);
  }

  if (parts.length === 0) {
    throw new Error(`OPC part path is empty: ${partPath}`);
  }
  return parts.join("/");
}

export function resolveOpcRelationshipTarget(
  sourcePartPath: string,
  target: string,
  targetMode = ""
): string {
  if (targetMode.toLowerCase() === "external") {
    return target;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) {
    return target;
  }
  if (target.startsWith("/")) {
    return normalizeOpcPartPath(target);
  }

  const source = normalizeOpcPartPath(sourcePartPath);
  const sourceDirectory = source.includes("/") ? source.slice(0, source.lastIndexOf("/")) : "";
  return normalizeOpcPartPath(sourceDirectory === "" ? target : `${sourceDirectory}/${target}`);
}

export function compareOpcPartPaths(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function buildOpcRelationshipsPath(sourcePartPath: string): string {
  const source = normalizeOpcPartPath(sourcePartPath);
  const slashIndex = source.lastIndexOf("/");
  const directory = slashIndex < 0 ? "" : source.slice(0, slashIndex);
  const fileName = slashIndex < 0 ? source : source.slice(slashIndex + 1);
  return directory === "" ? `_rels/${fileName}.rels` : `${directory}/_rels/${fileName}.rels`;
}
