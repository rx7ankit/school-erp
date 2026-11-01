import Foundation
import Observation

/// The languages the user can choose in Settings.
enum AppLanguage: String, CaseIterable, Identifiable {
    case system, en, hi

    var id: String { rawValue }

    /// Endonyms are never translated; "System" is, so it has a key.
    var title: String {
        switch self {
        case .system: return L.t("lang.system")
        case .en: return "English"
        case .hi: return "हिन्दी"
        }
    }
}

/// Holds the in-app language. @Observable, so every view body that calls `L.t`, `.sc(...)` or `IST`
/// is re-evaluated the moment the choice changes (no restart, no navigation reset).
@Observable
final class LanguageStore: @unchecked Sendable {
    static let shared = LanguageStore()
    static let storageKey = "appLanguage"

    /// Read it anywhere; change it only with `select(_:)` so it is saved.
    private(set) var choice: AppLanguage

    private init() {
        let saved = UserDefaults.standard.string(forKey: Self.storageKey) ?? ""
        choice = AppLanguage(rawValue: saved) ?? .system
    }

    func select(_ language: AppLanguage) {
        choice = language
        UserDefaults.standard.set(language.rawValue, forKey: Self.storageKey)
    }

    /// Only `.en` or `.hi`. "System" follows the device: Hindi if it is the first preferred language, else English.
    var resolved: AppLanguage {
        switch choice {
        case .en, .hi:
            return choice
        case .system:
            let first = Locale.preferredLanguages.first ?? "en"
            return first.hasPrefix("hi") ? .hi : .en
        }
    }

    var localeIdentifier: String { resolved == .hi ? "hi_IN" : "en_IN" }
    var locale: Locale { Locale(identifier: localeIdentifier) }

    /// The compiled `en.lproj` / `hi.lproj` inside the app bundle (built from Localizable.xcstrings).
    var bundle: Bundle {
        let code = resolved.rawValue
        Self.bundleLock.lock()
        defer { Self.bundleLock.unlock() }
        if let cached = Self.bundleCache[code] { return cached }
        var found = Bundle.main
        if let path = Bundle.main.path(forResource: code, ofType: "lproj"), let lproj = Bundle(path: path) {
            found = lproj
        }
        Self.bundleCache[code] = found
        return found
    }

    private static let bundleLock = NSLock()
    private static var bundleCache: [String: Bundle] = [:]
}

/// Look-ups in the active language. Keys live in Resources/Localizable.xcstrings.
enum L {
    static func t(_ key: String) -> String {
        NSLocalizedString(key, tableName: nil, bundle: LanguageStore.shared.bundle, value: key, comment: "")
    }

    /// Translates school data that has a known set of values (subjects, relations, terms).
    /// Unknown values are shown as given. "Social Science" looks up "subject.social_science".
    static func known(_ prefix: String, _ raw: String) -> String {
        let key = prefix + "." + raw.lowercased().replacingOccurrences(of: " ", with: "_")
        let text = t(key)
        return text == key ? raw : text
    }

    /// Formatted look-up. Use `%@` for text and `%1$@ %2$@` when Hindi needs a different word order.
    static func f(_ key: String, _ args: CVarArg...) -> String {
        String(format: t(key), locale: LanguageStore.shared.locale, arguments: args)
    }
}
