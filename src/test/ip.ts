// A simulated client IP for each test, sent in `x-forwarded-for`, so the rate
// limit, which counts per IP, never carries over from one test to the next.
// The addresses come from the three ranges RFC 5737 reserves for
// documentation, which are valid in `inet` and never belong to a real client.
const documentationRanges = ["192.0.2", "198.51.100", "203.0.113"];

let issued = 0;

export function nextTestIp() {
  const range =
    documentationRanges[Math.floor(issued / 254) % documentationRanges.length];
  const host = (issued % 254) + 1;
  issued += 1;
  return `${range}.${host}`;
}
