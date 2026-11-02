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
| Hero backdrop | `HeroBackdrop` | `sections/hero.tsx` | 2000 x 1100 (soft, light photo works best) |

Example: `<OwnerScene photo="/images/owner.jpg" />`. Keep each file under about 200 KB (JPEG or WebP) and use
photos with a light, even background so the black and white UI around them still reads cleanly.
