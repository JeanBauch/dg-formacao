import "server-only";

// The client's IP in the header Better Auth's rate limit reads
// (`x-forwarded-for`, its default), split as the rate limit splits it: by
// commas, each part trimmed and the empty ones dropped. Exactly one part is the
// IP, as it came; Better Auth's own reading would already cut an IPv6 address
// to its /64 (A5.11). Several parts are not one IP, so the log keeps none, as
// Better Auth trusts none without trusted proxies.
function ipOf(header: string | null) {
  const parts = (header ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
  return parts.length === 1 ? parts[0] : null;
}

// The client of a request, as it sent itself: its IP and its user agent. The
// IP goes whole to the security log, which keeps it and reduces it to its
// range itself.
export function clientOf(headers: Headers | undefined) {
  return {
    ip: ipOf(headers?.get("x-forwarded-for") ?? null),
    userAgent: headers?.get("user-agent") ?? null,
  };
}
