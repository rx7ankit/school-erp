import SwiftUI

enum Appearance: String, CaseIterable, Identifiable {
    case system, light, dark

    static let storageKey = "appearance"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .system: return L.t("lang.system")
        case .light: return L.t("set.light")
        case .dark: return L.t("set.dark")
        }
    }

    /// nil means "follow the device".
    var colorScheme: ColorScheme? {
        switch self {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }
}
