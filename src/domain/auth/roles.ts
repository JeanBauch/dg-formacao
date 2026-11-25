// The roles of an account, as the admin plugin keeps them in the user's role
// field: one value, or several separated by commas. An account with no staff
// role has the plugin's default, user.
export function rolesOf(role: string | null | undefined) {
  return (role ?? "")
    .split(",")
    .map((one) => one.trim())
    .filter((one) => one !== "");
}
