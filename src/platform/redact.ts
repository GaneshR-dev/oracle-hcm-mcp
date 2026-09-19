/**
 * Redaction middleware for tool results — strips obvious secrets / masks PII-ish fields.
 * Records redaction audit events when fields are stripped.
 */

import { recordRedaction } from './redactionAudit.js';

const SECRET_KEYS =
  /^(password|client_?secret|bearer_?token|access_?token|refresh_?token|authorization|api_?key)$/i;
const MASK_KEYS =
  /^(nationalIdentifier|NationalIdentifierNumber|BankAccountNumber|AccountNumber|IBAN|routingNumber|ssn|taxId|DateOfBirth|dateOfBirth|EmailAddress|emailAddress|PhoneNumber|phoneNumber|SalaryAmount|AnnualAmount|ProposedSalary|NetPay)$/i;

export type RedactOptions = {
  tool?: string;
  audit?: boolean;
};

export function redactDeep(value: unknown, depth = 0, opts: RedactOptions = {}, path = '$'): unknown {
  if (depth > 12 || value == null) return value;
  if (Array.isArray(value)) {
    return value.map((v, i) => redactDeep(v, depth + 1, opts, `${path}[${i}]`));
  }
  if (typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const childPath = `${path}.${k}`;
    if (SECRET_KEYS.test(k)) {
      out[k] = '[REDACTED]';
      if (opts.audit !== false) {
        recordRedaction({ tool: opts.tool, path: childPath, field: k, action: 'redacted' });
      }
    } else if (MASK_KEYS.test(k) && typeof v === 'string' && v.length > 4) {
      out[k] = `${'*'.repeat(Math.min(v.length - 4, 8))}${v.slice(-4)}`;
      if (opts.audit !== false) {
        recordRedaction({ tool: opts.tool, path: childPath, field: k, action: 'masked' });
      }
    } else {
      out[k] = redactDeep(v, depth + 1, opts, childPath);
    }
  }
  return out;
}
