import SwiftUI

/// Full-width pill button. `.solid` is black/white; `.brand` (orange) is reserved for the ONE main action of a screen.
struct PrimaryButton: View {
    enum Style {
        case solid
        case brand
    }

    let title: String
    var style: Style = .solid
    var isLoading = false
    var isEnabled = true
    let action: () -> Void

    private var background: Color { style == .brand ? Tokens.accent : Tokens.solid }
    private var foreground: Color { style == .brand ? Tokens.onAccent : Tokens.onSolid }

    var body: some View {
        Button(action: action) {
            ZStack {
                if isLoading {
                    ProgressView().tint(foreground)
                } else {
                    Text(title).font(.sc(.body, weight: .semibold))
                }
            }
            .foregroundStyle(foreground)
            .frame(maxWidth: .infinity, minHeight: Tokens.Control.lg)
            .background(background, in: Capsule())
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled || isLoading)
        .opacity(isEnabled ? 1 : 0.4)
    }
}
