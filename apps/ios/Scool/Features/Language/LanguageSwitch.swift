import SwiftUI

/// Compact floating "EN | हि" switch for the top of Home and Login. Same glass / material chrome as the bell.
struct LanguageSwitch: View {
    @Environment(LanguageStore.self) private var language

    var body: some View {
        HStack(spacing: 0) {
            ForEach(AppLanguage.allCases) { option in
                let isSelected = option == language.language
                Button {
                    language.select(option)
                } label: {
                    Text(option.shortName)
                        .font(.sc(.callout, weight: .semibold))
                        .foregroundStyle(isSelected ? Tokens.onSolid : Tokens.text)
                        .frame(minWidth: 40, minHeight: Tokens.Control.md - 8)
                        .background(isSelected ? Tokens.solid : Color.clear, in: Capsule())
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(option.nativeName)
                .accessibilityAddTraits(isSelected ? .isSelected : [])
            }
        }
        .padding(4)
        .chromeSurface()
        .accessibilityElement(children: .contain)
        .accessibilityLabel(L.f("lang.a11y", language.language.nativeName))
    }
}

/// Segmented "English | हिन्दी" picker with a label, for Settings.
struct LanguageSetting: View {
    @Environment(LanguageStore.self) private var language

    var body: some View {
        SectionLabel(L.t("lang.title"))
        Picker(L.t("lang.title"), selection: Binding(
            get: { language.language },
            set: { language.select($0) }
        )) {
            ForEach(AppLanguage.allCases) { option in
                Text(option.nativeName).tag(option)
            }
        }
        .pickerStyle(.segmented)
        Text(L.t("lang.settings_hint"))
            .font(.sc(.caption))
            .foregroundStyle(Tokens.textTertiary)
    }
}
