import { z } from "zod";

// The events of the security log (registro de segurança, RNF-SEG-15), a closed
// enum of the database. The PIN lockout joins in R3 as a new value, in an
// expand migration.
export const securityEventTypes = [
  "sign_in_succeeded",
  "sign_in_failed",
  "staff_sign_in_succeeded",
  "password_reset_requested",
  "password_reset_completed",
  "rate_limited",
  "account_locked",
  "access_denied",
] as const;

export type SecurityEventType = (typeof securityEventTypes)[number];

// Why a sign-in failed: wrong e-mail or password, or a staff account whose
// right password is shorter than 12 characters (A4.11).
export type SignInFailureReason =
  "invalid_credentials" | "staff_password_too_short";

// One occurrence of an event, as the auth module's hooks report it: the user
// when known, and the client's IP and user agent as the request sent them.
// Each event has a closed set of details (A5.13): the reason of a failed
// sign-in, the status of a refusal, and the minutes of an account lockout
// (A2.15). The other events have none.
export type SecurityEvent = {
  userId: string | null;
  ip: string | null;
  userAgent: string | null;
  route: string;
} & (
  | { event: "sign_in_failed"; reason: SignInFailureReason }
  | { event: "access_denied"; status: 403 | 404 }
  | { event: "account_locked"; lockMinutes: 1 | 5 | 15 }
  | {
      event: Exclude<
        SecurityEventType,
        "sign_in_failed" | "access_denied" | "account_locked"
      >;
    }
);

// The details a row keeps for an occurrence: only its event's closed set, so
// nothing else the caller passed, personal data included, reaches the log.
function details(occurrence: SecurityEvent) {
  switch (occurrence.event) {
    case "sign_in_failed":
      return { reason: occurrence.reason };
    case "access_denied":
      return { status: occurrence.status };
    case "account_locked":
      return { lockMinutes: occurrence.lockMinutes };
    default:
      return null;
  }
}

// The routes a row may name (A5.13): patterns, where a segment in brackets
// stands for any one segment. They are the R0's: the Better Auth endpoints
// that answer (A4.17), as its rate limit names them, without the base path,
// and the pages behind a session.
const routes = [
  "/sign-up/email",
  "/sign-in/email",
  "/sign-out",
  "/get-session",
  "/request-password-reset",
  "/reset-password",
  "/reset-password/[token]",
  "/send-verification-email",
  "/verify-email",
  "/conta",
  "/backoffice",
  "/backoffice/equipe/convite",
];

// The pattern of the list a route or a received path matches, or "other":
// never the path itself, which could carry a token or personal data.
function routePattern(route: string) {
  const segments = route.split("/");
  const pattern = routes.find((candidate) => {
    const parts = candidate.split("/");
    return (
      parts.length === segments.length &&
      parts.every(
        (part, index) =>
          part === segments[index] ||
          (part.startsWith("[") && segments[index] !== ""),
      )
    );
  });
  return pattern ?? "other";
}

// How much of the user agent a row keeps (A5.13), in characters, as Postgres
// counts them in the column.
export const userAgentMaxLength = 256;

function cutUserAgent(userAgent: string | null) {
  if (userAgent === null) return null;
  return Array.from(userAgent).slice(0, userAgentMaxLength).join("");
}

// The detail that is part of the key (A5.13): the reason of a failed sign-in or
// the status of a refusal, both from short closed lists.
function keyDetail(occurrence: SecurityEvent) {
  if (occurrence.event === "sign_in_failed") return occurrence.reason;
  if (occurrence.event === "access_denied") return String(occurrence.status);
  return null;
}

// The validators Better Auth checks the client's IP with.
const ipv4 = z.ipv4();
const ipv6 = z.ipv6();

// The eight 16-bit groups of a valid IPv6 address. An IPv4 address written in
// its last 32 bits counts as two groups.
function ipv6Groups(ip: string) {
  const dotted = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip);
  const hex = dotted
    ? ip.slice(0, dotted.index) +
      [
        (Number(dotted[1]) << 8) | Number(dotted[2]),
        (Number(dotted[3]) << 8) | Number(dotted[4]),
      ]
        .map((group) => group.toString(16))
        .join(":")
    : ip;
  const [head, tail] = hex.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const zeros =
    tail === undefined
      ? []
      : Array<string>(8 - left.length - right.length).fill("0");
  return [...left, ...zeros, ...right].map((group) =>
    Number.parseInt(group, 16),
  );
}

// The client's IP range, the one Better Auth's rate limit counts by, in the
// same form: an IPv4 address whole, an IPv4-mapped IPv6 address as its IPv4,
// and any other IPv6 address by its /64 network, with every group written in
// full. Null for a value that is not an IP.
function ipRange(ip: string) {
  if (ipv4.safeParse(ip).success) return ip;
  if (!ipv6.safeParse(ip).success) return null;
  const groups = ipv6Groups(ip);
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff)
    return [groups[6] >> 8, groups[6] & 255, groups[7] >> 8, groups[7] & 255]
      .map(String)
      .join(".");
  return [...groups.slice(0, 4), 0, 0, 0, 0]
    .map((group) => group.toString(16).padStart(4, "0"))
    .join(":");
}

// The client's IP as the row keeps it: the full address, as the request sent
// it, and its range; both empty when there is no IP or the value is not one
// (A5.11).
function clientIp(ip: string | null) {
  const range = ip === null ? null : ipRange(ip);
  return { ip: range === null ? null : ip, range };
}

// The row of the security log that an occurrence at this instant counts in
// (A5.3): the key of the row, and the values it keeps from its first
// occurrence. An empty part of the key is written as "-", and the minute is
// the UTC one, as in 2026-11-24T13:05.
export function securityLogRow(occurrence: SecurityEvent, at: Date) {
  const { ip, range } = clientIp(occurrence.ip);
  const route = routePattern(occurrence.route);
  const minute = at.toISOString().slice(0, 16);
  const key = [
    occurrence.event,
    keyDetail(occurrence),
    occurrence.userId,
    range,
    route,
    minute,
  ];
  return {
    dedupeKey: key.map((part) => part ?? "-").join(":"),
    event: occurrence.event,
    userId: occurrence.userId,
    ip,
    userAgent: cutUserAgent(occurrence.userAgent),
    route,
    details: details(occurrence),
    firstAt: at,
    lastAt: at,
  };
}
