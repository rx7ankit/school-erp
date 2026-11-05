import SwiftUI

/// Labelled single-line text or password field on a flat grey surface.
struct AppField: View {
    let title: String
    @Binding var text: String
    var isSecure = false
    var keyboard: UIKeyboardType = .default
    var contentType: UITextContentType? = nil
    var submitLabel: SubmitLabel = .done
    var onSubmit: (() -> Void)? = nil

    @State private var revealed = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.sc(.caption, weight: .semibold))
                .foregroundStyle(Tokens.textSecondary)
            HStack(spacing: Tokens.Space.s2) {
                input
                    .submitLabel(submitLabel)
                    .onSubmit { onSubmit?() }
                if isSecure {
                    Button { revealed.toggle() } label: {
                        Image(systemName: revealed ? "eye.slash" : "eye")
                            .font(.system(size: 16))
                            .foregroundStyle(Tokens.textTertiary)
                            .frame(width: Tokens.Control.md, height: Tokens.Control.md)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(revealed ? "Hide password" : "Show password")
                }
            }
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
        if isSecure && !revealed {
            SecureField("", text: $text)
        } else {
            TextField("", text: $text)
        }
    }
}
