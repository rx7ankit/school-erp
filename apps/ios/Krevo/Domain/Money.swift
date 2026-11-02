import Foundation

/// Money is integer paise. Shown as "₹18,500" with Indian digit grouping.
enum Money {
    private static let lock = NSLock()
    private static var formatters: [String: NumberFormatter] = [:]

    /// One formatter per app language (en_IN or hi_IN). Both group digits the Indian way: 1,50,000.
    private static func formatter() -> NumberFormatter {
        let localeId = AppLanguage.current.localeIdentifier
        lock.lock()
        defer { lock.unlock() }
        if let found = formatters[localeId] { return found }
        let f = NumberFormatter()
        f.locale = Locale(identifier: localeId)
        f.numberStyle = .decimal
        f.usesGroupingSeparator = true
        f.minimumFractionDigits = 0
        f.maximumFractionDigits = 2
        formatters[localeId] = f
        return f
    }

    /// "-₹1,000" for negative amounts (discounts), plain "₹1,000" otherwise.
    static func formatSigned(paise: Int) -> String {
        paise < 0 ? "-" + format(paise: -paise) : format(paise: paise)
    }

    static func format(paise: Int) -> String {
        let rupees = Double(paise) / 100.0
        let text = formatter().string(from: NSNumber(value: rupees)) ?? String(Int(rupees))
        return "₹" + text
    }
}
