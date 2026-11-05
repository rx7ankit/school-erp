import SwiftUI

/// Round avatar with initials. The tint comes from the name, so the same person always has the same colour
/// and a list of people is easier to scan.
struct Avatar: View {
    let name: String
    var size: CGFloat = 36

    private static let tints: [Color] = [
        Color(light: 0xF26A1B),   // orange
        Color(light: 0x2F6FED),   // blue
        Color(light: 0x1E8E3E),   // green
        Color(light: 0x8E4BEC),   // violet
        Color(light: 0xD6336C),   // pink
        Color(light: 0x0E8A9B),   // teal
    ]

    private var tint: Color {
        let sum = name.unicodeScalars.reduce(0) { ($0 &* 31 &+ Int($1.value)) & 0xFFFF }
        return Self.tints[sum % Self.tints.count]
    }

    private var initials: String {
        let parts = name.split(separator: " ").prefix(2)
        return parts.map { String($0.prefix(1)) }.joined().uppercased()
    }

    var body: some View {
        Text(initials)
            .font(.system(size: size * 0.38, weight: .bold))
            .foregroundStyle(tint)
            .frame(width: size, height: size)
            .background(tint.opacity(0.14), in: Circle())
            .accessibilityHidden(true)
    }
}
