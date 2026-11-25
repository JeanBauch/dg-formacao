import { createElement, Fragment } from "react";
import { renderToReadableStream } from "next/dist/compiled/react-server-dom-webpack/server.node";

// Calls each function from its own Server Component, all in one render, as the
// components of one page request do, and returns what each one returned, in
// order. The render is React's own (the renderer Next.js renders pages with),
// so React scopes `cache` to it as it does to a request. Needs the
// `react-server` condition, which the database tests have.
export async function inOneServerRender<T>(callers: (() => Promise<T>)[]) {
  const results: T[] = [];
  const errors: unknown[] = [];
  const components = callers.map((call, index) => {
    async function Caller() {
      results[index] = await call();
      return null;
    }
    return createElement(Caller, { key: index });
  });
  const stream = renderToReadableStream(
    createElement(Fragment, null, ...components),
    {},
    { onError: (error) => errors.push(error) },
  );
  await new Response(stream).text();
  if (errors.length > 0) throw errors[0];
  return results;
}
