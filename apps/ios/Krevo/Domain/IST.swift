import Foundation

/// The ONLY place dates are parsed or formatted.
/// - `*_at` strings are UTC ISO-8601 instants and are always shown in Asia/Kolkata.
/// - `*_on` strings ("2026-11-01") are plain school dates and are never zone-shifted
///   (they are parsed and printed in the same fixed zone, so no shift can happen).
enum IST {
    static let zone: TimeZone = TimeZone(identifier: "Asia/Kolkata") ?? TimeZone(secondsFromGMT: 19800) ?? TimeZone.current
    private static let utc: TimeZone = TimeZone(secondsFromGMT: 0) ?? TimeZone.current

    // MARK: Formatters

    /// Formatters are cached per pattern, zone and locale (en_IN or hi_IN, following the app language).
    private static let cacheLock = NSLock()
    private static var cache: [String: DateFormatter] = [:]

    private static func fmt(_ pattern: String, zone: TimeZone, posix: Bool = false) -> DateFormatter {
        let localeId = posix ? "en_US_POSIX" : AppLanguage.current.localeIdentifier
        let key = pattern + "|" + zone.identifier + "|" + localeId
        cacheLock.lock()
        defer { cacheLock.unlock() }
        if let found = cache[key] { return found }
        let f = DateFormatter()
        f.locale = Locale(identifier: localeId)
        f.calendar = Calendar(identifier: .gregorian)
        f.timeZone = zone
        f.dateFormat = pattern
        cache[key] = f
        return f
    }

    private static let month = "MMM"

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

    private static var dateTimeFmt: DateFormatter { fmt("d \(month) yyyy, h:mm a", zone: zone) }
    private static var timeFmt: DateFormatter { fmt("h:mm a", zone: zone) }
    private static var dayFmt: DateFormatter { fmt("d \(month) yyyy", zone: zone) }
    private static var weekdayFmt: DateFormatter { fmt("EEEE", zone: zone) }
    private static var hourFmt: DateFormatter { fmt("H", zone: zone, posix: true) }
    private static var todayFmt: DateFormatter { fmt("yyyy-MM-dd", zone: zone, posix: true) }

    // Date-only formatters work in UTC on purpose: parse and print use the same zone.
    private static var onParse: DateFormatter { fmt("yyyy-MM-dd", zone: utc, posix: true) }
    private static var onFmt: DateFormatter { fmt("d \(month) yyyy", zone: utc) }
    private static var onShortFmt: DateFormatter { fmt("d \(month)", zone: utc) }
    private static var onWeekdayFmt: DateFormatter { fmt("EEEE", zone: utc) }
    private static var monthParse: DateFormatter { fmt("yyyy-MM", zone: utc, posix: true) }
    private static var monthTitleFmt: DateFormatter { fmt("MMMM yyyy", zone: utc) }

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

    /// Weekday of a timestamp, in IST: "Saturday"
    static func weekday(_ iso: String) -> String {
        guard let d = parse(iso) else { return iso }
        return weekdayFmt.string(from: d)
    }

    /// Weekday of a date-only string: "Saturday"
    static func weekdayName(on: String) -> String {
        guard let d = onParse.date(from: on) else { return on }
        return onWeekdayFmt.string(from: d)
    }

    /// Current UTC instant as an ISO string (what the API would store).
    static func nowISO() -> String {
        isoPlain.string(from: Date())
    }

    /// Hour of day (0-23) right now in IST.
    static func currentHour() -> Int {
        Int(hourFmt.string(from: Date())) ?? 12
    }

    /// Clock time right now in IST as "14:35", for comparing with period times.
    static func nowHM() -> String {
        fmt("HH:mm", zone: zone, posix: true).string(from: Date())
    }

    /// Short weekday of a date-only string ("Mon", or "सोम" in Hindi).
    static func shortWeekday(on: String) -> String {
        String(weekdayName(on: on).prefix(3))
    }

    /// Day of month of a date-only string: "2026-11-05" -> "5".
    static func dayNumber(_ on: String) -> String {
        String(Int(on.suffix(2)) ?? 0)
    }

    /// Monday to Saturday of the week that contains `on` (a school week).
    static func schoolWeek(containing on: String) -> [String] {
        let offset = (weekdayIndex(on) + 6) % 7    // Monday = 0
        let monday = addDays(on, -offset)
        return (0..<6).map { addDays(monday, $0) }
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

    /// "2026-11-01" + 21 -> "2026-11-22" (calendar days, never zone-shifted)
    static func addDays(_ on: String, _ days: Int) -> String {
        guard let d = onParse.date(from: on),
              let n = utcCalendar.date(byAdding: .day, value: days, to: d) else { return on }
        return onParse.string(from: n)
    }

    // MARK: Date pickers

    /// DatePicker works in this zone (UTC), so a picked day maps 1:1 to a school date.
    /// Set `.environment(\.timeZone, IST.pickerZone)` on the picker.
    static var pickerZone: TimeZone { utc }

    static func pickerDate(on: String) -> Date {
        onParse.date(from: on) ?? Date()
    }

    /// The school date a DatePicker value stands for: "2026-11-03"
    static func on(pickerDate: Date) -> String {
        onParse.string(from: pickerDate)
    }

    /// Month of a timestamp in IST: "2026-10"
    static func month(of iso: String) -> String {
        guard let d = parse(iso) else { return currentMonth() }
        return fmt("yyyy-MM", zone: zone, posix: true).string(from: d)
    }

    // MARK: Academic year (April to March)

    /// "2026-27" for any timestamp from April 2026 to March 2027, in IST.
    static func academicYear(of iso: String) -> String {
        guard let d = parse(iso) else { return "" }
        let ym = fmt("yyyy-MM", zone: zone, posix: true).string(from: d)
        let year = Int(ym.prefix(4)) ?? 0
        let month = Int(ym.suffix(2)) ?? 1
        let start = month >= 4 ? year : year - 1
        let endTwoDigits = (start + 1) % 100
        return "\(start)-" + (endTwoDigits < 10 ? "0\(endTwoDigits)" : "\(endTwoDigits)")
    }

    static func currentAcademicYear() -> String {
        academicYear(of: nowISO())
    }

    /// Whole days between a timestamp and now (0 = today). Nil if the timestamp cannot be read.
    static func daysSince(_ iso: String) -> Int? {
        guard let d = parse(iso) else { return nil }
        return Int(Date().timeIntervalSince(d) / 86_400)
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
