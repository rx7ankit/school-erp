import SwiftUI

/// Round avatar with initials.
struct Avatar: View {
    let name: String
    var size: CGFloat = 36

    private var initials: String {
        let parts = name.split(separator: " ").prefix(2)
        return parts.map { String($0.prefix(1)) }.joined().uppercased()
    }

    var body: some View {
        Text(initials)
            .font(.system(size: size * 0.4, weight: .bold))
            .foregroundStyle(Tokens.accent)
            .frame(width: size, height: size)
            .background(Tokens.accentSubtle, in: Circle())
            .accessibilityHidden(true)
    }
}
