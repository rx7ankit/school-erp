import SwiftUI
import Observation

/// The two languages of the parent app. The choice is stored under `krevo.lang`.
enum AppLanguage: String, CaseIterable, Identifiable {
    case en, hi

    static let storageKey = "krevo.lang"

    /// The language used by code that is not a view (L.t, IST, Money, the PDF builders).
    /// LanguageStore keeps it in step with the choice. Until the parent chooses, it is English.
    static var current: AppLanguage = stored ?? .en

    /// nil until the parent has chosen once.
    static var stored: AppLanguage? {
        UserDefaults.standard.string(forKey: storageKey).flatMap { AppLanguage(rawValue: $0) }
    }

    var id: String { rawValue }

    /// Dates and rupees use these locales (Indian digit grouping in both).
    var localeIdentifier: String { self == .hi ? "hi_IN" : "en_IN" }
    var locale: Locale { Locale(identifier: localeIdentifier) }

    /// "English" / "हिन्दी", the same text in every language.
    var nativeName: String { L.t(self == .hi ? "lang.hindi" : "lang.english", in: self) }
    /// "EN" / "हि", for the compact switch.
    var shortName: String { L.t(self == .hi ? "lang.short_hi" : "lang.short_en", in: self) }

    // MARK: Strings bundle

    private static let bundleLock = NSLock()
    private static var bundles: [String: Bundle] = [:]

    /// The `en.lproj` / `hi.lproj` folder of the app bundle, so strings can be read in a language
    /// other than the device language. Falls back to the main bundle if the folder is missing.
    var bundle: Bundle {
        Self.bundleLock.lock()
        defer { Self.bundleLock.unlock() }
        if let found = Self.bundles[rawValue] { return found }
        let path = Bundle.main.path(forResource: rawValue, ofType: "lproj")
        let bundle = path.flatMap { Bundle(path: $0) } ?? Bundle.main
        Self.bundles[rawValue] = bundle
        return bundle
    }
}

/// The in-app language choice. It overrides the device language straight away, with no restart:
/// the root view injects `.environment(\.locale, ...)` and tab content is rebuilt when the choice changes.
@Observable
@MainActor
final class LanguageStore {
    private(set) var language: AppLanguage
    /// False on the very first launch: the language chooser is shown until the parent picks one.
    private(set) var hasChosen: Bool
    /// Set by KrevoApp so a change can be sent to the backend when signed in.
    @ObservationIgnored var onChange: (@MainActor (AppLanguage) -> Void)?

    init() {
        let stored = AppLanguage.stored
        language = stored ?? .en
        hasChosen = stored != nil
        AppLanguage.current = language
    }

    func select(_ option: AppLanguage) {
        let changed = option != language || !hasChosen
        UserDefaults.standard.set(option.rawValue, forKey: AppLanguage.storageKey)
        AppLanguage.current = option
        language = option
        hasChosen = true
        if changed { onChange?(option) }
    }
}
