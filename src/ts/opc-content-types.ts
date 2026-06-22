import { normalizeOpcPartPath } from "./opc-part-path.js";
import { escapeXmlAttribute, parseXmlAttributes } from "./xml-helper.js";

export interface OpcContentTypeDefault {
  extension: string;
  contentType: string;
}

export interface OpcContentTypeOverride {
  partName: string;
  contentType: string;
}

export interface OpcContentTypes {
  defaults: OpcContentTypeDefault[];
  overrides: OpcContentTypeOverride[];
}

export function parseOpcContentTypesXml(xml: string): OpcContentTypes {
  const defaults: OpcContentTypeDefault[] = [];
  const overrides: OpcContentTypeOverride[] = [];

  for (const match of xml.matchAll(/<Default\b([^>]*)\/?>/g)) {
    const attributes = parseXmlAttributes(match[1] ?? "");
    const extension = attributes.get("Extension");
    const contentType = attributes.get("ContentType");
    if (extension !== undefined && contentType !== undefined) {
      defaults.push({ extension, contentType });
    }
  }

  for (const match of xml.matchAll(/<Override\b([^>]*)\/?>/g)) {
    const attributes = parseXmlAttributes(match[1] ?? "");
    const partName = attributes.get("PartName");
    const contentType = attributes.get("ContentType");
    if (partName !== undefined && contentType !== undefined) {
      overrides.push({ partName: normalizeOpcPartPath(partName), contentType });
    }
  }

  return { defaults, overrides };
}

export function resolveOpcContentType(contentTypes: OpcContentTypes, partPath: string): string | undefined {
  const normalized = normalizeOpcPartPath(partPath);
  const override = contentTypes.overrides.find((item) => item.partName === normalized);
  if (override !== undefined) {
    return override.contentType;
  }

  const extension = normalized.includes(".") ? normalized.slice(normalized.lastIndexOf(".") + 1) : "";
  return contentTypes.defaults.find((item) => item.extension === extension)?.contentType;
}

export function buildOpcContentTypesXml(contentTypes: OpcContentTypes): string {
  const defaults = contentTypes.defaults.map((item) => (
    `<Default Extension="${escapeXmlAttribute(item.extension)}" ContentType="${escapeXmlAttribute(item.contentType)}"/>`
  )).join("");
  const overrides = contentTypes.overrides.map((item) => (
    `<Override PartName="/${escapeXmlAttribute(normalizeOpcPartPath(item.partName))}" ContentType="${escapeXmlAttribute(item.contentType)}"/>`
  )).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${defaults}${overrides}</Types>`;
}
