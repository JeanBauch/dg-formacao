import { setUpTestDatabase } from "./setup";

// Global setup of the db test project: runs once per test run, before its first
// test file.
export default async function setup() {
  await setUpTestDatabase();
}
