import Foundation

/// The ONLY place dates are parsed or formatted.
/// - `*_at` strings are UTC ISO-8601 instants and are always shown in Asia/Kolkata.
/// - `*_on` strings ("2026-11-01") are plain school dates and are never zone-shifted
///   (they are parsed and printed in the same fixed zone, so no shift can happen).
enum IST {
    static let zone: TimeZone = TimeZone(identifier: "Asia/Kolkata") ?? TimeZone(secondsFromGMT: 19800) ?? TimeZone.current
    private static let utc: TimeZone = TimeZone(secondsFromGMT: 0) ?? TimeZone.current

    // MARK: Formatters

    private static func formatter(_ pattern: String, zone: TimeZone, posix: Bool = false) -> DateFormatter {
        let f = DateFormatter()
        f.locale = Locale(identifier: posix ? "en_US_POSIX" : "en_IN")
        f.calendar = Calendar(identifier: .gregorian)
        f.timeZone = zone
        f.dateFormat = pattern
        return f
    }

    private static let isoPlain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
    private static let isoFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let dateTimeFmt = formatter("d MMM yyyy, h:mm a", zone: zone)
    private static let timeFmt = formatter("h:mm a", zone: zone)
    private static let dayFmt = formatter("d MMM yyyy", zone: zone)
    private static let hourFmt = formatter("H", zone: zone, posix: true)
    private static let todayFmt = formatter("yyyy-MM-dd", zone: zone, posix: true)

    // Date-only formatters work in UTC on purpose: parse and print use the same zone.
    private static let onParse = formatter("yyyy-MM-dd", zone: utc, posix: true)
    private static let onFmt = formatter("d MMM yyyy", zone: utc)
    private static let onShortFmt = formatter("d MMM", zone: utc)
    private static let monthParse = formatter("yyyy-MM", zone: utc, posix: true)
    private static let monthTitleFmt = formatter("MMMM yyyy", zone: utc)

    private static var utcCalendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = utc
        return c
    }()

    // MARK: Timestamps (UTC ISO -> IST text)

    static func parse(_ iso: String) -> Date? {
        isoPlain.date(from: iso) ?? isoFraction.date(from: iso)
    }

    /// "31 Oct 2026, 2:50 pm"
    static func dateTime(_ iso: String) -> String {
        guard let d = parse(iso) else { return iso }
        return dateTimeFmt.string(from: d)
    }

    /// "2:50 pm"
    static func time(_ iso: String) -> String {
        guard let d = parse(iso) else { return iso }
        return timeFmt.string(from: d)
    }

    /// Calendar day of a timestamp, in IST: "31 Oct 2026"
    static func day(_ iso: String) -> String {
        guard let d = parse(iso) else { return iso }
        return dayFmt.string(from: d)
    }

    /// Current UTC instant as an ISO string (what the API would store).
    static func nowISO() -> String {
        isoPlain.string(from: Date())
    }

    /// Hour of day (0-23) right now in IST.
    static func currentHour() -> Int {
        Int(hourFmt.string(from: Date())) ?? 12
    }

    /// Today's school date in IST: "2026-11-01"
    static func todayOn() -> String {
        todayFmt.string(from: Date())
    }

    /// Current month in IST: "2026-11"
    static func currentMonth() -> String {
        String(todayOn().prefix(7))
    }

    // MARK: Date-only strings (never zone-shifted)

    /// "1 Nov 2026"
    static func date(_ on: String) -> String {
        guard let d = onParse.date(from: on) else { return on }
        return onFmt.string(from: d)
    }

    /// "8 Nov - 12 Nov 2026" or a single date when from == to.
    static func dateRange(from: String, to: String) -> String {
        if from == to { return date(from) }
        guard let a = onParse.date(from: from) else { return date(from) }
        return onShortFmt.string(from: a) + " - " + date(to)
    }

    // MARK: Month helpers ("yyyy-MM")

    /// "November 2026"
    static func monthTitle(_ month: String) -> String {
        guard let d = monthParse.date(from: month) else { return month }
        return monthTitleFmt.string(from: d)
    }

    static func daysInMonth(_ month: String) -> Int {
        guard let d = monthParse.date(from: month) else { return 30 }
        return utcCalendar.range(of: .day, in: .month, for: d)?.count ?? 30
    }

    /// 0 = Sunday ... 6 = Saturday, for the first day of the month.
    static func firstWeekdayIndex(_ month: String) -> Int {
        guard let d = monthParse.date(from: month) else { return 0 }
        return utcCalendar.component(.weekday, from: d) - 1
    }

    /// 0 = Sunday ... 6 = Saturday for a date-only string.
    static func weekdayIndex(_ on: String) -> Int {
        guard let d = onParse.date(from: on) else { return 0 }
        return utcCalendar.component(.weekday, from: d) - 1
    }

    static func addMonths(_ month: String, _ delta: Int) -> String {
        guard let d = monthParse.date(from: month),
              let n = utcCalendar.date(byAdding: .month, value: delta, to: d) else { return month }
        return monthParse.string(from: n)
    }

    /// "2026-11" + 5 -> "2026-11-05"
    static func dayOn(_ month: String, _ day: Int) -> String {
        month + "-" + (day < 10 ? "0\(day)" : "\(day)")
    }
}
