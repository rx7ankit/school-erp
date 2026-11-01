import SwiftUI

/// Labelled single-line text or password field on a flat grey surface.
struct AppField: View {
    let title: String
    @Binding var text: String
    var isSecure = false
    var keyboard: UIKeyboardType = .default
    var contentType: UITextContentType? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.sc(.caption, weight: .semibold))
                .foregroundStyle(Tokens.textSecondary)
            input
                .font(.sc(.body))
                .foregroundStyle(Tokens.text)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(keyboard)
                .textContentType(contentType)
                .padding(.horizontal, Tokens.Space.s4)
                .frame(minHeight: Tokens.Control.lg)
                .background(Tokens.card, in: RoundedRectangle(cornerRadius: Tokens.Radius.control, style: .continuous))
                .accessibilityLabel(title)
        }
    }

    @ViewBuilder
    private var input: some View {
        if isSecure {
            SecureField("", text: $text)
        } else {
            TextField("", text: $text)
        }
    }
}
