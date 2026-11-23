// Runs once when a server instance starts, before it handles requests. Loading
// the validated environment here makes an invalid configuration stop the start.
export async function register() {
  await import("./env");
}
