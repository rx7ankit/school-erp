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
    /// A colour from a hex value. The app is light only.
    init(light: UInt32) {
        self.init(uiColor: UIColor(hex: light))
    }
}

enum Tokens {
    // Colours
    static let bg = Color(light: 0xFFFFFF)
    static let card = Color(light: 0xF5F5F7)
    static let fill = Color(light: 0xE8E8ED)
    static let text = Color(light: 0x1D1D1F)
    static let textSecondary = Color(light: 0x6E6E73)
    static let textTertiary = Color(light: 0x86868B)
    static let separator = Color(light: 0xD2D2D7)
    static let accent = Color(light: 0xF26A1B)
    static let accentSubtle = Color(light: 0xFFF0E6)
    static let onAccent = Color(light: 0xFFFFFF)
    static let solid = Color(light: 0x000000)
    static let onSolid = Color(light: 0xFFFFFF)
    static let success = Color(light: 0x1E8E3E)
    static let warning = Color(light: 0xB25E00)
    /// Leave days (calendar dot and legend).
    static let leave = Color(light: 0x8E4BEC)
    /// Holidays: a quiet grey dot.
    static let holiday = Color(light: 0xB0B0B8)
    static let danger = Color(light: 0xD70015)

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
