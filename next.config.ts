import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  // The file adapter writes to .mailbox at run time, and the build's file tracing
  // would list the messages already there among the deployment files of a route
  // that loads the mailer: each holds a recipient and a link with a live token.
  // The key matches every route, so one that loads the mailer later is covered.
  outputFileTracingExcludes: {
    "/*": ["./.mailbox/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
