// The React Server Components renderer that Next.js ships and renders pages
// with, which has no types of its own. Only what src/test/server-render.ts uses.
declare module "next/dist/compiled/react-server-dom-webpack/server.node" {
  import type { ReactNode } from "react";

  export function renderToReadableStream(
    model: ReactNode,
    webpackMap: Record<string, never>,
    options?: { onError?: (error: unknown) => void },
  ): ReadableStream<Uint8Array>;
}
