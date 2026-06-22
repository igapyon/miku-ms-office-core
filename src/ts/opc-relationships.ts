import { normalizeOpcPartPath, resolveOpcRelationshipTarget } from "./opc-part-path.js";
import { escapeXmlAttribute, parseXmlAttributes } from "./xml-helper.js";

export interface OpcRelationship {
  id: string;
  type: string;
  target: string;
  targetMode?: string;
}

export function parseOpcRelationshipsXml(xml: string): OpcRelationship[] {
  const relationships: OpcRelationship[] = [];
  const pattern = /<Relationship\b([^>]*)\/?>/g;

  for (const match of xml.matchAll(pattern)) {
    const attributes = parseXmlAttributes(match[1] ?? "");
    const id = attributes.get("Id");
    const type = attributes.get("Type");
    const target = attributes.get("Target");
    if (id === undefined || type === undefined || target === undefined) {
      continue;
    }

    const targetMode = attributes.get("TargetMode");
    relationships.push(
      targetMode === undefined ? { id, type, target } : { id, type, target, targetMode }
    );
  }

  return relationships;
}

export function buildOpcRelationshipsXml(relationships: OpcRelationship[]): string {
  const rels = relationships.map((relationship) => {
    const targetMode = relationship.targetMode === undefined
      ? ""
      : ` TargetMode="${escapeXmlAttribute(relationship.targetMode)}"`;
    return `<Relationship Id="${escapeXmlAttribute(relationship.id)}" Type="${escapeXmlAttribute(relationship.type)}" Target="${escapeXmlAttribute(relationship.target)}"${targetMode}/>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}

export function resolveOpcRelationships(
  relationships: OpcRelationship[],
  sourcePartPath: string
): OpcRelationship[] {
  return relationships.map((relationship) => ({
    ...relationship,
    target: resolveOpcRelationshipTarget(sourcePartPath, relationship.target, relationship.targetMode)
  }));
}

export function relationshipArrayToMap(relationships: OpcRelationship[]): Map<string, OpcRelationship> {
  return new Map(relationships.map((relationship) => [relationship.id, relationship]));
}
