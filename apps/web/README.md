# Scool web (staff)

Next.js 16, Tailwind v4, shadcn-style components (`src/components/ui`), Scool design tokens.

```bash
pnpm install
pnpm dev:web      # from repo root, http://localhost:3000
```

- Demo data lives in `src/lib/mock.ts`. Swap for API calls when the FastAPI backend exists.
- Sign in as any demo staff member on `/login`. The menu changes with their permissions.
- Permission rules: `src/lib/permissions.ts`. Nav: `src/components/app/nav.ts`. Gate UI with `<Can access="...">`.
- Time: `src/lib/time.ts`. Store UTC, show IST, dates are plain `YYYY-MM-DD`, money is paise.
- Data model and permission matrix: `docs/erd.md`.
