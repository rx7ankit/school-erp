import Foundation

/// Look-ups in the string catalog (Resources/Localizable.xcstrings: English and Hindi). Keys are like "home.today".
/// They read the strings of the language chosen in the app (`AppLanguage.current`), not the device language.
enum L {
    /// Pass `language` to force one (the staff placeholder is always English).
    static func t(_ key: String, in language: AppLanguage? = nil) -> String {
        NSLocalizedString(key, tableName: nil, bundle: (language ?? AppLanguage.current).bundle, value: key, comment: "")
    }

    /// Translates school data that has a known set of values (subjects, relations, terms).
    /// Unknown values are shown as given. "Social Science" looks up "subject.social_science".
    static func known(_ prefix: String, _ raw: String) -> String {
        let key = prefix + "." + raw.lowercased().replacingOccurrences(of: " ", with: "_")
        let text = t(key)
        return text == key ? raw : text
    }

    /// Formatted look-up. Use `%@` for text and `%1$@ %2$@` for numbered arguments.
    static func f(_ key: String, _ args: CVarArg...) -> String {
        String(format: t(key), locale: AppLanguage.current.locale, arguments: args)
    }
}
