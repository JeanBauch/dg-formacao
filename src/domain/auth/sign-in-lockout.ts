// The lockout of an account's sign-in after failed sign-ins in a row
// (RF-AUT-05, A2.15), for holders and staff alike. Its values are provisional.

// The failures in a row that lock the sign-in for the first time.
const firstLockFailures = 5;

// The minutes of each lock, in order: the first one at the 5th failure in a
// row, then one more for each failure after a lock, up to the ceiling.
const lockMinutes = [1, 5, 15] as const;

export type LockMinutes = (typeof lockMinutes)[number];

// The lock that the failure with this count in a row starts, in minutes, or
// null when it starts none: the 5th failure locks for 1 minute, the 6th for 5
// and every one after it for 15, the ceiling.
export function lockStartedBy(failures: number): LockMinutes | null {
  if (failures < firstLockFailures) return null;
  const level = Math.min(failures - firstLockFailures, lockMinutes.length - 1);
  return lockMinutes[level];
}

// Whether an account's sign-in is locked at this instant, by its failures in a
// row and when the latest of them failed: a lock counts from that failure.
export function isSignInLocked(
  { failures, lastFailedAt }: { failures: number; lastFailedAt: Date },
  at: Date,
) {
  const minutes = lockStartedBy(failures);
  return (
    minutes !== null && at.getTime() < lastFailedAt.getTime() + minutes * 60_000
  );
}
