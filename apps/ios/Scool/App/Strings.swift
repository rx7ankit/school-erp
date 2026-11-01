import Foundation

/// Look-ups in the English string catalog (Resources/Localizable.xcstrings). Keys are like "home.today".
enum L {
    static func t(_ key: String) -> String {
        NSLocalizedString(key, tableName: nil, bundle: Bundle.main, value: key, comment: "")
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
        String(format: t(key), locale: Locale(identifier: "en_IN"), arguments: args)
    }
}
