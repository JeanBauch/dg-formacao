---
name: seo
description: SEO and Core Web Vitals rules for public Next.js 16 pages: metadata, canonical, status codes, sitemap and robots, JSON-LD, images, fonts and scripts. Use when writing or reviewing public pages or their tests.
---

Rules for public, indexable pages in Next.js 16.4. Private areas get `noindex` and stop here.

## Metadata

- Export `metadata` or `generateMetadata` from Server Components (`page.tsx`, `layout.tsx`) only; the App Router has no `next/head`.
- The root layout sets `metadataBase` and a `title` with `template` and `default`. A template applies to child segments only.
- Every indexable page sets `description` and `alternates.canonical`: absolute (via `metadataBase`), self-referencing, without tracking or filter parameters.
- Segment metadata merges shallowly: a page that sets `openGraph` replaces the layout's whole `openGraph` object.
- Fetch the record for `generateMetadata` and the page through one `React.cache`-wrapped data function.
- With Cache Components, `generateMetadata` that reads data uses `"use cache"` and returns strings, not `URL` objects.

## Status codes

- Call `notFound()` before any `<Suspense>` or `loading.tsx` starts streaming. After streaming starts, the status stays 200 (a soft 404).
- Renamed public URLs use `permanentRedirect()` (308) or `redirects` with `permanent: true`.
- A filter combination with no results returns a 404.

## Indexing policy

- Private areas (student, lessons, login, checkout): `robots: { index: false, follow: false }` in the route group's layout, absent from the sitemap, and anonymous visitors are redirected to login.
- Pagination: one URL per page, each with a self-referencing canonical and `<a href>` links between pages.
- Sorting, internal search and reordering filters: `noindex`. Categories with real search value become paths (`/courses/category/js`) and enter the sitemap.
- Build the canonical from a closed allowlist of parameters; never echo the query string.
- A page that must be read as `noindex` stays crawlable: `robots.txt` never blocks it.
- Internal navigation uses `next/link`, which renders `<a href>`.

## Sitemap and robots

- `app/sitemap.ts` lists only canonical, indexable URLs with a truthful `lastModified`. Leave out `priority` and `changeFrequency`, which Google ignores. Above 50,000 URLs, split the sitemap with `generateSitemaps`, whose `id` is a `Promise<string>`.
- `app/robots.ts` points to every sitemap URL.

## Structured data

- Render JSON-LD in a Server Component as a native `<script type="application/ld+json">` with `JSON.stringify(data).replace(/</g, '\\u003c')`, never through `next/script`.
- JSON-LD mirrors visible content, and only on pages Google can reach without login.
- Course page: `Course` with `name`, `description` and `provider` (an `Organization` with `name` and `sameAs`), plus `BreadcrumbList` with at least two items. Course names carry no prices or promotions.
- Catalog: `ItemList` of `ListItem` with `position` and the canonical `url`.
- Home: `Organization`. A public lesson preview: `VideoObject` with `name`, `thumbnailUrl` and `uploadDate`.
- Build each JSON-LD object in a pure, unit-tested function (`buildCourseJsonLd(course)`).

## Core Web Vitals

- The LCP image uses `next/image` with `width`/`height` (or `fill` with `sizes`) and `fetchPriority="high"` or `preload`. In lists, only the first visible row uses `loading="eager"`.
- Remote images that use `placeholder="blur"` provide a `blurDataURL`.
- Fonts come from `next/font` in the root layout.
- Third-party scripts use `next/script` with `afterInteractive` or `lazyOnload`.
- Reserve space for anything that streams in or loads late (skeletons with the final height, fixed embed dimensions).
- Interaction cost (INP) falls with fewer Client Components: render long outlines as server HTML (`<details>`), and hydrate only the toggle.

## Verify

Write the Playwright checks in [SEO-TESTS.md](SEO-TESTS.md) for every new public route. Lighthouse and the Rich Results Test run after deploy, against public URLs.

## Version traps

- `priority` on `next/image` is deprecated; use `fetchPriority="high"` or `preload`.
- The Course info rich result (`CourseInstance`, `offers`, `hasCourseInstance`) was retired in 2025; the Course list carousel remains.
- Google ignores `rel="next"`/`"prev"`, and the sitemap's `priority`/`changefreq`.
- Dynamic pages stream metadata into `<body>` for regular clients; HTML-limited bots get it in `<head>` (`htmlLimitedBots`).
- `next-sitemap` is unnecessary: `sitemap.ts` and `robots.ts` are built in.
