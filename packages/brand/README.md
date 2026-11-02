# @school/brand — Slov logo assets

Source of truth: the mark geometry in `svg/mark.svg` (four pieces, 180° rotational symmetry).

| File | Use |
|---|---|
| `svg/mark.svg`, `logo.svg` | Inline in UI. Uses `currentColor`, so it follows light/dark text colour |
| `svg/mark-black.svg`, `mark-white.svg`, `logo-black.svg`, `logo-white.svg` | Fixed colour versions |
| `svg/favicon.svg` | Browser tab icon (black on light tabs, white on dark tabs) |
| `svg/app-icon.svg` | Rounded black tile with white mark |
| `png/ios-app-icon-1024.png` | iOS App Store / Xcode icon (square, iOS rounds it) |
| `png/android-foreground-432.png` | Android adaptive icon foreground, set background to `#000000` |
| `png/app-icon-1024.png` | Play Store listing icon (rounded tile) |
| `png/icon-192.png`, `icon-512.png` | Web manifest icons |
| `png/apple-touch-icon-180.png` | iOS home screen icon for web |
| `favicon.ico` | 16/32/48 fallback |

The wordmark "Slov" is outlined from Plus Jakarta Sans Bold, so it needs no font.
