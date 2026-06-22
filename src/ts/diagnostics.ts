export type DiagnosticSeverity = "info" | "warning" | "error";

export interface OfficeDiagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  path?: string;
}

export function createDiagnostic(
  severity: DiagnosticSeverity,
  code: string,
  message: string,
  path?: string
): OfficeDiagnostic {
  return path === undefined ? { severity, code, message } : { severity, code, message, path };
}
