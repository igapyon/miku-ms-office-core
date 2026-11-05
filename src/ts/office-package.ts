import { parseOpcContentTypesXml, type OpcContentTypes } from "./opc-content-types.js";
import { createDiagnostic, type OfficeDiagnostic } from "./diagnostics.js";
import { buildOpcRelationshipsPath, normalizeOpcPartPath } from "./opc-part-path.js";
import { parseOpcRelationshipsXml, resolveOpcRelationships, type OpcRelationship } from "./opc-relationships.js";
import { getZipTextEntry, readZipPackage, type ZipEntry, type ZipReadOptions } from "./zip-package.js";

export interface OfficePackage {
  entries: ZipEntry[];
  contentTypes?: OpcContentTypes;
  diagnostics: OfficeDiagnostic[];
}

export interface ReadOfficePartRelationshipsOptions {
  resolveTargets?: boolean;
}

export async function readOfficePackage(
  data: Uint8Array,
  options: ZipReadOptions = {}
): Promise<OfficePackage> {
  const zip = await readZipPackage(data, options);
  return buildOfficePackageFromZipReadResult(zip.entries, zip.diagnostics);
}

/** @deprecated Use readOfficePackage; retained as the same function reference for 1.x. */
export const readOfficePackageAsync = readOfficePackage;

function buildOfficePackageFromZipReadResult(entries: ZipEntry[], zipDiagnostics: OfficeDiagnostic[]): OfficePackage {
  const diagnostics = [...zipDiagnostics];
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error" && diagnostic.code.startsWith("zip."))) {
    return { entries: [], diagnostics };
  }
  const contentTypesXml = getZipTextEntry(entries, "[Content_Types].xml");
  let contentTypes: OpcContentTypes | undefined;

  if (contentTypesXml === undefined) {
    diagnostics.push(
      createDiagnostic(
        "warning",
        "opc.content_types.missing",
        "The package does not contain [Content_Types].xml.",
        "[Content_Types].xml"
      )
    );
  } else {
    contentTypes = parseOpcContentTypesXml(contentTypesXml);
  }

  return contentTypes === undefined
    ? { entries, diagnostics }
    : { entries, contentTypes, diagnostics };
}

export function listOfficeMediaParts(entries: ZipEntry[]): ZipEntry[] {
  return entries.filter((entry) => normalizeOpcPartPath(entry.path).includes("/media/"));
}

export function readOfficePartRelationships(
  entries: ZipEntry[],
  sourcePartPath: string,
  options: ReadOfficePartRelationshipsOptions = {}
): OpcRelationship[] {
  const relsXml = getZipTextEntry(entries, buildOpcRelationshipsPath(sourcePartPath));
  if (relsXml === undefined) {
    return [];
  }

  const relationships = parseOpcRelationshipsXml(relsXml);
  return options.resolveTargets === false
    ? relationships
    : resolveOpcRelationships(relationships, sourcePartPath);
}
