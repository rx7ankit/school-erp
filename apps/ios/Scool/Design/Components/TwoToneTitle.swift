import SwiftUI

/// Heading with an ink phrase followed by a grey phrase.
struct TwoToneTitle: View {
    let ink: String
    let grey: String
    var role: TextRole = .title2

    private var attributed: AttributedString {
        var first = AttributedString(ink)
        first.foregroundColor = Tokens.text
        var second = AttributedString(grey.isEmpty ? "" : " " + grey)
        second.foregroundColor = Tokens.textTertiary
        first.append(second)
        return first
    }

    var body: some View {
        Text(attributed)
            .font(.sc(role))
            .lineSpacing(LanguageStore.shared.resolved == .hi ? 4 : 0)
            .frame(maxWidth: .infinity, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityLabel(grey.isEmpty ? ink : ink + " " + grey)
            .accessibilityAddTraits(.isHeader)
    }
}
