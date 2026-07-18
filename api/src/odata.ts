/**
 * Escape a string value for use inside an OData string literal (single-quoted).
 * In OData, single quotes inside a string literal must be doubled: ' → ''
 */
export function escapeODataString(value: string): string {
  return value.replace(/'/g, "''")
}
