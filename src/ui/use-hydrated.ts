"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// Whether React already runs this page in the browser. A form whose action
// runs in the browser goes nowhere before that, so its button stays disabled
// until then. The server's render and the hydration read false, and every
// render after them reads true.
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
