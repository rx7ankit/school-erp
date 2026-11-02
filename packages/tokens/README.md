# @slov/tokens

Single source of truth: `tokens.json`. Run `pnpm --filter @slov/tokens build` to regenerate `dist/`.

- `dist/tokens.css` — CSS variables (light/dark, follows OS, override with `<html data-theme="light|dark">`), no shadows
- `dist/tailwind.css` — Tailwind v4 theme mapping (`bg-card`, `text-text-secondary`, `bg-accent`, ...)
- `preview.html` — open in a browser to review the look

Later: generate Swift / Android XML from the same JSON for iOS and Android.
