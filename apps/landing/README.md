# Krevo landing site

Next.js 16, Tailwind 4, design tokens from `packages/tokens`. Live at krevo.tech.

```bash
pnpm dev     # http://localhost:3001
pnpm build
```

All copy lives in `src/lib/content.ts`.

## Images

There are no photos yet. Every image slot is an inline SVG illustration in `src/components/art/` and is
already framed (rounded corners, fixed ratio). To use a real photo, put the file in `public/images/` and pass its
path as the `photo` prop. The photo replaces the illustration inside the same frame (`object-cover`).

| Slot | Component (src/components/art/) | Used in | Recommended size |
| --- | --- | --- | --- |
| Owner | `OwnerScene` | `sections/roles.tsx` | 1200 x 900 (4:3) |
| Teacher | `TeacherScene` | `sections/roles.tsx` | 1200 x 900 (4:3) |
| Parent | `ParentScene` | `sections/roles.tsx` | 1200 x 900 (4:3) |
| Family | `FamilyScene` | `sections/parent-app.tsx` | 1200 x 1200 (square, cropped to 4:3 or tall) |
| School | `SchoolScene` | `sections/contact.tsx` | 1200 x 900 (4:3) |
| School-day band | `SchoolDayBand` | `app/page.tsx` | 2400 x 400 (wide, shown full width, 190 to 260 px tall) |

Example: `<OwnerScene photo="/images/owner.jpg" />`. Keep each file under about 200 KB (JPEG or WebP) and use
photos with a light, even background so the black and white UI around them still reads cleanly.

## Motion

Smooth scrolling is `lenis` (`components/motion/smooth-scroll.tsx`, mounted in `app/layout.tsx`). The motion kit lives in
`src/components/motion/` (usage block at the top of `index.ts`); its CSS is under "Motion" in `globals.css`.

| Primitive | Use |
| --- | --- |
| `Reveal` | fade up + blur-to-sharp: `delay`, `y`, `blur`, `duration`, `once`, `i`/`stagger` for lists |
| `WordReveal` | words slide up in masks: `title` + `dim` (two-tone), `text`, `\n` for line breaks, `stagger` |
| `CountUp` | number roll: `to`, `prefix`, `suffix`, `decimals`; final value in SSR, width reserved |
| `DrawLine` | SVG stroke draw: `d` (string or array), `viewBox`, `delay`, `duration`, `stagger` |
| `Pop` | scale .6 to 1 with overshoot; `i` + `stagger` for groups. Owns `transform` |
| `ScrollWords` | words brighten 30% to 100% with scroll (quotes) |
| `Parallax` | translateY by scroll factor (`speed`, `origin="center" | "top"`) |
| `Ambient` | fixed page background (grey base, white/cool/peach glows, grain) |

All accept `on="view"` (default) or `on="hero"` (plays with the hero reveal). They are visible without JS and show the
final state for reduced motion. Anchor links glide with a 16px offset; `useLenis()` returns the instance. Anything that sets
`html { overflow: hidden }` pauses Lenis; add `data-lenis-prevent` to inner scrollers. The first-visit intro
(`components/intro/intro.tsx`, once per session, skipped with a hash or reduced motion) is driven by `html[data-intro]`.
Elevation: box-shadow is banned by the tokens, use fills or `filter: drop-shadow()`.
