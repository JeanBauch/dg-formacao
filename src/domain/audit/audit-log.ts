import { createHash } from "node:crypto";

// The fields of an entity as an audit row records them, before or after a
// change: plain values only.
export type AuditFields = Record<string, string | number | boolean | null>;

// One staff action (registro de auditoria, RNF-OBS-10): who did what to which
// entity, and the entity's fields before and after. A creation has nothing
// before, and a deletion nothing after.
export type AuditEntry = {
  actorUserId: string;
  action: string;
  entity: string;
  entityId: string;
  before: AuditFields | null;
  after: AuditFields | null;
};

// The longest text a diff keeps whole (A4.22), in characters.
const wholeTextMaxLength = 256;

// A field as the diff keeps it: whole up to 256 characters, and a longer text
// as its length in characters and the SHA-256 of its UTF-8 bytes, so the row
// stays small whatever the entity holds.
function diffValue(value: AuditFields[string]) {
  if (typeof value !== "string") return value;
  const length = Array.from(value).length;
  if (length <= wholeTextMaxLength) return value;
  return { length, sha256: createHash("sha256").update(value).digest("hex") };
}

function diffFields(fields: AuditFields | null) {
  if (fields === null) return null;
  return Object.fromEntries(
    Object.entries(fields).map(([name, value]) => [name, diffValue(value)]),
  );
}

// The diff an audit row keeps: the fields before and after the change.
export function auditDiff(entry: AuditEntry) {
  return { before: diffFields(entry.before), after: diffFields(entry.after) };
}
