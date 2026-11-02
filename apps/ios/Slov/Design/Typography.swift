import SwiftUI
import UIKit

/// Roles follow tokens.json `text`. Sizes scale with Dynamic Type.
enum TextRole {
    case title1, title2, title3, body, callout, caption

    var size: CGFloat {
        switch self {
        case .title1: return 40
        case .title2: return 28
        case .title3: return 20
        case .body: return 17
        case .callout: return 15
        case .caption: return 13
        }
    }

    var style: Font.TextStyle {
        switch self {
        case .title1: return .largeTitle
        case .title2: return .title
        case .title3: return .title3
        case .body: return .body
        case .callout: return .callout
        case .caption: return .caption
        }
    }

    var defaultWeight: Font.Weight {
        switch self {
        case .title1, .title2, .title3: return .bold
        default: return .regular
        }
    }
}

enum AppFont {
    /// PostScript names of the Plus Jakarta Sans static fonts.
    private static func fontName(for weight: Font.Weight) -> String {
        if weight == .medium { return "PlusJakartaSans-Medium" }
        if weight == .semibold { return "PlusJakartaSans-SemiBold" }
        if weight == .bold { return "PlusJakartaSans-Bold" }
        if weight == .heavy || weight == .black { return "PlusJakartaSans-ExtraBold" }
        return "PlusJakartaSans-Regular"
    }

    static func font(_ role: TextRole, weight: Font.Weight? = nil) -> Font {
        let w = weight ?? role.defaultWeight
        // Plus Jakarta Sans has no Devanagari. In Hindi use the system font for everything, so the
        // headings keep the same bold weight and Dynamic Type still applies.
        if AppLanguage.current == .hi {
            return Font.system(role.style).weight(w)
        }
        let name = fontName(for: w)
        // Fall back to the system font when the TTF is not bundled.
        if UIFont(name: name, size: role.size) != nil {
            return Font.custom(name, size: role.size, relativeTo: role.style)
        }
        return Font.system(role.style).weight(w)
    }
}

extension Font {
    static func sc(_ role: TextRole, weight: Font.Weight? = nil) -> Font {
        AppFont.font(role, weight: weight)
    }
}
