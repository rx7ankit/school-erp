import SwiftUI
import UIKit

// Source of truth: packages/tokens/tokens.json

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1)
    }
}

extension Color {
    /// A colour that follows the current light/dark appearance.
    init(light: UInt32, dark: UInt32) {
        self.init(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light)
        })
    }
}

enum Tokens {
    // Colours
    static let bg = Color(light: 0xFFFFFF, dark: 0x000000)
    static let card = Color(light: 0xF5F5F7, dark: 0x1C1C1E)
    static let fill = Color(light: 0xE8E8ED, dark: 0x2C2C2E)
    static let text = Color(light: 0x1D1D1F, dark: 0xF5F5F7)
    static let textSecondary = Color(light: 0x6E6E73, dark: 0xA1A1A6)
    static let textTertiary = Color(light: 0x86868B, dark: 0x6E6E73)
    static let separator = Color(light: 0xD2D2D7, dark: 0x38383A)
    static let accent = Color(light: 0xF26A1B, dark: 0xFF7A2E)
    static let accentSubtle = Color(light: 0xFFF0E6, dark: 0x2A1A0F)
    static let onAccent = Color(light: 0xFFFFFF, dark: 0x000000)
    static let solid = Color(light: 0x000000, dark: 0xFFFFFF)
    static let onSolid = Color(light: 0xFFFFFF, dark: 0x000000)
    static let success = Color(light: 0x1E8E3E, dark: 0x30D158)
    static let warning = Color(light: 0xB25E00, dark: 0xFFB340)
    /// Leave days (calendar dot and legend).
    static let leave = Color(light: 0x8E4BEC, dark: 0xB07CFF)
    /// Holidays: a quiet grey dot.
    static let holiday = Color(light: 0xB0B0B8, dark: 0x6E6E73)
    static let danger = Color(light: 0xD70015, dark: 0xFF453A)

    // Radius
    enum Radius {
        static let control: CGFloat = 12
        static let card: CGFloat = 20
    }

    // Spacing (tokens space 1...7)
    enum Space {
        static let s1: CGFloat = 4
        static let s2: CGFloat = 8
        static let s3: CGFloat = 12
        static let s4: CGFloat = 16
        static let s5: CGFloat = 24
        static let s6: CGFloat = 32
        static let s7: CGFloat = 48
    }

    // Control heights
    enum Control {
        static let sm: CGFloat = 32
        static let md: CGFloat = 44
        static let lg: CGFloat = 52
    }
}
