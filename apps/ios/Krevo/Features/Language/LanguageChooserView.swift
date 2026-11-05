import SwiftUI

/// Shown once, on the first launch, before anything else. The choice is stored and can be changed later
/// from the switch on Home or from Settings. The heading and both buttons are bilingual on purpose.
struct LanguageChooserView: View {
    @Environment(LanguageStore.self) private var language

    var body: some View {
        ScreenScroll {
            Image("LogoMark")
                .renderingMode(.template)
                .resizable()
                .scaledToFit()
                .frame(width: 48, height: 48)
                .foregroundStyle(Tokens.text)
                .padding(.top, Tokens.Space.s6)
                .accessibilityHidden(true)

            TwoToneTitle(ink: L.t("lang.choose_ink"), grey: L.t("lang.choose_grey"), role: .title1)
                .padding(.bottom, Tokens.Space.s3)

            ForEach(AppLanguage.allCases) { option in
                Button {
                    language.select(option)
                } label: {
                    Text(option.nativeName)
                        .font(.sc(.title3))
                        .foregroundStyle(Tokens.onSolid)
                        .frame(maxWidth: .infinity, minHeight: 72)
                        .background(Tokens.solid, in: Capsule())
                        .contentShape(Capsule())
                }
                .buttonStyle(.pressable)
            }
        }
    }
}
