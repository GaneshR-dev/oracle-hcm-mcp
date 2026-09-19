/**
 * Conservative ADF q= quoting. Rejects odd field names to avoid filter injection.
 */

export function adfEquals(key: string, value: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) {
    throw new Error(`Invalid ADF field name: ${key}`);
  }
  const escaped = String(value).replace(/'/g, "''");
  return `${key}='${escaped}'`;
}
