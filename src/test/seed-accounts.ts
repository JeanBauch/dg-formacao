// The fictitious accounts of the seed (A1.8), kept in one place so the seed and
// the tests and E2E suites that sign in with them agree on every value. Their
// e-mails are of a domain reserved for documentation (RFC 2606), and their
// passwords exist only here and in the tests (RNF-QUA-02, RNF-SEG-14).
export const seedHolder = {
  name: "Titular Fictício",
  email: "titular@example.com",
  password: "senha-do-seed-1",
  // The account's own simulated IP, in the range RFC 5737 reserves for
  // documentation. It is the last address of the range, which the tests' IP
  // helper never issues, so the rate limit counts the seed apart from any test.
  ip: "203.0.113.255",
};
