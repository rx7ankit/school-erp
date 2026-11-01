# Scool for iOS (parent app)

SwiftUI, Swift 5.10+, MVVM with `@Observable`, iOS 17.0 minimum. No third-party packages.
Spec: `docs/mobile/parent-app-spec.md`. Tokens: `packages/tokens/tokens.json`.

## Build

```sh
brew install xcodegen
cd apps/ios
xcodegen && open Scool.xcodeproj
```

The Xcode project and `Scool/Info.plist` are generated from `project.yml`; never edit or commit them.
Use **Xcode 26** (the iOS 26 SDK) so the Liquid Glass code compiles. The app still runs on iOS 17 to 25 using
`.ultraThinMaterial` fallbacks. All glass vs fallback logic is in `Scool/Design/ChromeSurface.swift`.

## Fonts (Plus Jakarta Sans)

The app looks for these files, declared in `UIAppFonts`:

```
Scool/Resources/Fonts/PlusJakartaSans-Regular.ttf
Scool/Resources/Fonts/PlusJakartaSans-Medium.ttf
Scool/Resources/Fonts/PlusJakartaSans-SemiBold.ttf
Scool/Resources/Fonts/PlusJakartaSans-Bold.ttf
Scool/Resources/Fonts/PlusJakartaSans-ExtraBold.ttf
```

1. Download the family from https://fonts.google.com/specimen/Plus+Jakarta+Sans (Get font, Download all).
2. Unzip. Copy the five static TTFs above from the `static/` folder into `Scool/Resources/Fonts/`.
3. Run `xcodegen` again so the files are added to the target.

Without the TTFs the app falls back to the system font automatically (see `Design/Typography.swift`).

## Demo accounts (mock data)

| Email | Password | Result |
|---|---|---|
| parent@demo.in | Scool@123 | Parent with two children (Aarav 8-B, Diya 6-A) |
| new@demo.in | Temp@1234 | Forced "Change password" first |
| staff@demo.in | Scool@123 | Staff placeholder screen |
| left@demo.in | Scool@123 | One child who left school (banner, messaging off) |

## Layout

```
Scool/App        ScoolApp, RootView (routing), Session, MainTabView, Appearance
Scool/Design     Tokens, Typography, ChromeSurface (glass), Components/
Scool/Domain     Models, IST (the only date formatter), Money
Scool/Data       Repository protocol, MockRepository + MockData, ApiRepository (stub)
Scool/Features   One folder per screen: View + ViewModel
```

## Rules enforced in code

- `*_at` UTC ISO strings are shown only through `IST` (Asia/Kolkata). `*_on` dates are never zone-shifted.
- Money is integer paise, shown via `Money.format` as `₹18,500` (en_IN grouping).
- Parents are read-only except messaging (personal threads) and changing password.
- No shadows. Flat grey cards. Orange only for the active tab, primary action and key highlights.

## Going live

Implement `Data/ApiRepository.swift` (marked TODO) and construct `Session(repo: ApiRepository(baseURL: ...))` in `ScoolApp`.
