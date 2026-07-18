export function escapeXmlText(value: string): string {
  return sanitizeXmlText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function escapeXmlAttribute(value: string): string {
  return escapeXmlText(value).replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function sanitizeXmlText(value: string): string {
  return value.replace(
    /[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu,
    ""
  );
}

export function parseXmlAttributes(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const pattern = /([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (const match of tag.matchAll(pattern)) {
    attributes.set(match[1], decodeXmlEntities(match[2] ?? match[3] ?? ""));
  }
  return attributes;
}

export function decodeXmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
