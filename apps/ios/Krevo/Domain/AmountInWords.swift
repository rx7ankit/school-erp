import Foundation

/// Indian-style amount in English words, for fee receipts: "Rupees Twelve Thousand Five Hundred Only".
enum AmountInWords {
    private static let ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
                               "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
                               "Eighteen", "Nineteen"]
    private static let tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    private static func below100(_ n: Int) -> String {
        if n < 20 { return ones[n] }
        let rest = n % 10
        return rest == 0 ? tens[n / 10] : tens[n / 10] + " " + ones[rest]
    }

    private static func below1000(_ n: Int) -> String {
        let hundreds = n / 100
        let rest = n % 100
        var parts: [String] = []
        if hundreds > 0 { parts.append(ones[hundreds] + " Hundred") }
        if rest > 0 { parts.append(below100(rest)) }
        return parts.joined(separator: " ")
    }

    static func rupees(_ value: Int) -> String {
        if value == 0 { return "Zero" }
        var n = value
        var parts: [String] = []
        let crore = n / 10_000_000
        n %= 10_000_000
        let lakh = n / 100_000
        n %= 100_000
        let thousand = n / 1000
        n %= 1000
        if crore > 0 { parts.append(below1000(crore) + " Crore") }
        if lakh > 0 { parts.append(below100(lakh) + " Lakh") }
        if thousand > 0 { parts.append(below100(thousand) + " Thousand") }
        if n > 0 { parts.append(below1000(n)) }
        return parts.joined(separator: " ")
    }

    static func english(paise: Int) -> String {
        let rupeePart = paise / 100
        let paisePart = paise % 100
        var text = "Rupees " + rupees(rupeePart)
        if paisePart > 0 { text += " and " + below100(paisePart) + " Paise" }
        return text + " Only"
    }
}
