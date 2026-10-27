<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Structure

- Server functions live in `src/lib/*.functions.ts`. Never put them in a `src/server/` directory: the client import-protection pattern `**/server/**` denies route and component imports of anything under it, so the app fails to load.
- Pure business rules (alert thresholds, deduplication, ordering) live in a plain module such as `src/lib/alerts.ts` and are imported by the server functions. Keeping them free of server imports makes them unit-testable with vitest.
- The signed-in area is gated by the pathless layout `src/routes/_authenticated/route.tsx`, which is client-only and redirects to `/auth`. The dashboard is `/`, the login screen is `/auth`, and there is no public landing page — `src/routes/index.tsx` must not exist, or the route generator fails the build with a duplicate `/`.
- Design tokens (palette, spacing, type scale, fonts) are defined in `src/styles.css` under `@theme`; components use the generated utilities instead of hardcoded color values. Web fonts are loaded with a `<link>` in `src/routes/__root.tsx`, never with a remote `@import` in the stylesheet.
- Asset-sheet DTO assembly lives in the client-safe `src/lib/asset-sheet.ts`; authenticated server readers scope every versioned query to the summary's import and reuse dashboard alerts, so historical imports cannot leak into current figures.
- Private storage links are signed using the caller's authenticated Supabase client and normalized to the browser-facing storage origin; document links are minted on download after an asset-scoped read, so cached pages do not serve expired links or bypass RLS.
- Excel imports are parsed and checked in the browser with exceljs (`src/lib/import-template.ts`, pure and unit-tested); writes go through the admin-checked `commitImport` server function, which deletes the pending import row (cascading to its versioned data) and the stored file on any failure.
- `/rapports` dispatches by the authenticated profile role: preserve the admin workflow and expose a separate read-only investor list; investor reads and click-time PDF signing use caller-scoped server functions with RLS, never the admin readers or browser-supplied storage paths.
