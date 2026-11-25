// The public interface of the audit module's domain.
export { auditDiff } from "./audit-log";
export type { AuditEntry } from "./audit-log";
export {
  isOutsideCap,
  isStaffRole,
  overflowKeyPrefix,
  overflowRow,
  securityEventRow,
  securityEventTypes,
  userAgentMaxLength,
} from "./security-events";
export type { SecurityEvent } from "./security-events";
