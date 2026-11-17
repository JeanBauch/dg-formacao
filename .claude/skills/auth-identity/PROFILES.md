# Profiles, active profile and PIN

Read when a change touches profiles, profile switching, the PIN, the child catalog scope or the holder's view of a child's progress. The rules come from RF-PRF-01 to 05 and 11, RN-04, RPV-04 and DP-13.

## Profiles

- Every user has one primary `standard` profile, created in the same flow as the user (RF-PRF-01). No user exists without one, and a test asserts it.
- A user has at most 5 profiles. A profile has a name, an avatar from the fixed set, and its `kind`.
- The use case that creates a child profile checks four things, in this order (RF-AUT-02, RF-PRF-06, RPV-04, DP-13):
  1. the user's e-mail is verified;
  2. the account has a phone number in E.164 format;
  3. the guardian declaration is recorded in `consents`, with its text version;
  4. the PIN is set. The first child profile's flow asks for it.

## Active profile

- The active profile is server-side state in `session_profiles(session_id, profile_id)`, written only by `setActiveProfile`. A client-held value, even a signed cookie, could be copied and replayed to skip the PIN.
- `setActiveProfile` checks that the target profile belongs to the session's user; otherwise it returns `notFound()`.
- Leaving a `child` profile for a `standard` one requires `verifyPin`. Switching child to child, or standard to anything, needs no PIN.
- The row is deleted with its session (foreign key with cascade), so sign-out and revocation clear it.

## PIN

- 4 to 6 digits, stored in `account_pins` as a scrypt hash (`node:crypto`) with its own salt, and compared with `timingSafeEqual`.
- Five wrong attempts lock PIN entry for 15 minutes (`locked_until`). A correct PIN resets the counter.
- Resetting the PIN requires a fresh session, one signed in within the last 10 minutes. Otherwise the UI sends the holder to sign in again (RF-PRF-11: reset with the account password).

## Catalog scope

- `scope = kind === 'child' ? 'child' : 'standard'`. Visitors without a session get `standard`.
- Catalog, home, search, course page, lesson and `/media/{id}` reads all take the scope (skill `data-layer`). A course outside the scope returns `notFound()`, so a child profile cannot even learn that it exists.

## Holder's read-only view (RF-PRF-05)

Open only from an active `standard` profile, and only for the user's own child profiles. It reads enrollments and progress and writes nothing: no enrollment, no progress, no change of active profile.

## Tests

- A child profile never sees a restricted course in the catalog, home, search, course page, lesson or media route.
- Switching from child to standard without a PIN fails; five wrong PINs lock entry; a correct PIN after the lock expires succeeds.
- Another user's profile id returns `notFound()` from `setActiveProfile` and from the holder's view.
- Requests to `/api/auth/*` cannot change the active profile.
