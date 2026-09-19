/**
 * Redaction middleware for tool results — strips obvious secrets / masks PII-ish fields.
 */

const SECRET_KEYS =
  /^(password|client_?secret|bearer_?token|access_?token|refresh_?token|authorization|api_?key)$/i;
const MASK_KEYS =
  /^(nationalIdentifier|NationalIdentifierNumber|BankAccountNumber|AccountNumber|IBAN|routingNumber|ssn|taxId)$/i;

export function redactDeep(value: unknown, depth = 0): unknown {
  if (depth > 12 || value == null) return value;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, depth + 1));
  if (typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEYS.test(k)) {
      out[k] = '[REDACTED]';
    } else if (MASK_KEYS.test(k) && typeof v === 'string' && v.length > 4) {
      out[k] = `${'*'.repeat(Math.min(v.length - 4, 8))}${v.slice(-4)}`;
    } else {
      out[k] = redactDeep(v, depth + 1);
    }
  }
  return out;
}
