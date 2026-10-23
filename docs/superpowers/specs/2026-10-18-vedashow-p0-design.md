# VedaShow P0 Design

## Intent

Remove avoidable trust, navigation and measurement failures before attracting
more traffic to VedaShow. The first increment consolidates category aliases and
preserves useful legacy URLs without changing production data.

## Goals

- Give each equivalent category concept one canonical key.
- Redirect empty duplicate category URLs to the active canonical category.
- Redirect known VedaShow legacy paths directly to current destinations.
- Preserve query parameters and avoid redirect chains.
- Keep all behavior tenant-scoped so another store cannot inherit VedaShow URLs.

## Non-goals

- Mutating the production catalog or merging categories automatically.
- Redesigning the storefront.
- Publishing, deploying or changing server configuration.
- Inventing redirects where the legacy destination is not verified.

## Constraints

- The platform is multi-tenant and the request host selects the storefront.
- Existing category URLs containing products remain accessible until an explicit
  consolidation moves those products.
- Category consolidation remains an authenticated admin operation.
- No commit or push until the complete P0 module has tests and visual evidence.

## Design

Category equivalence lives in a pure library shared by public routing and the
admin consolidation route. It normalizes verified plural and historical names
without changing stored slugs. Public resolution redirects only when the source
category is empty or absent and an active equivalent exists.

Legacy storefront redirects live in a pure, host-aware library invoked by the
Next proxy. The initial map contains only VedaShow URLs already documented in
the repository. Redirects point straight to final routes and preserve the query.

## Verification

- Unit tests pin category equivalence and tenant-scoped redirects.
- Existing category, sitemap and proxy behavior stays green.
- TypeScript, ESLint, full tests and production build run before completion.
- Desktop and mobile screenshots are required before commit or push.
