import Foundation

/// Money is integer paise. Shown as "₹18,500" with Indian digit grouping.
enum Money {
    private static let formatter: NumberFormatter = {
        let f = NumberFormatter()
        f.locale = Locale(identifier: "en_IN")
        f.numberStyle = .decimal
        f.usesGroupingSeparator = true
        f.minimumFractionDigits = 0
        f.maximumFractionDigits = 2
        return f
    }()

    static func format(paise: Int) -> String {
        let rupees = Double(paise) / 100.0
        let text = formatter.string(from: NSNumber(value: rupees)) ?? String(Int(rupees))
        return "₹" + text
    }
}
