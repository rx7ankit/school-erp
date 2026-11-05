import Foundation
import Observation

@Observable
@MainActor
final class AttendanceViewModel {
    var month: String     // "yyyy-MM"

    init(month: String = IST.currentMonth()) { self.month = month }
    var days: Loadable<[AttendanceDay]> = .loading

    var canGoNext: Bool { month < IST.currentMonth() }

    func load(repo: any Repository, childId: String) async {
        let requested = month
        let result = await Loadable<[AttendanceDay]>.capture {
            try await repo.attendanceMonth(childId: childId, month: requested)
        }
        // Ignore a slow answer for a month the user already left.
        if requested == month { days = result }
    }

    func shift(_ delta: Int) {
        month = IST.addMonths(month, delta)
        days = .loading
    }
}

/// One month of the year list.
struct MonthSummary: Identifiable, Hashable {
    let month: String           // "yyyy-MM"
    let stats: AttendanceStats
    var id: String { month }
    static func == (a: MonthSummary, b: MonthSummary) -> Bool { a.month == b.month && a.stats.total == b.stats.total && a.stats.present == b.stats.present }
    func hash(into h: inout Hasher) { h.combine(month) }
}

/// The academic year so far: every month from April to now, and the combined total.
struct YearAttendance {
    let label: String           // "2026-27"
    let months: [MonthSummary]  // oldest first
    let total: AttendanceStats
}

@Observable
@MainActor
final class YearAttendanceViewModel {
    var state: Loadable<YearAttendance> = .loading

    func load(repo: any Repository, childId: String) async {
        if state.value == nil { state = .loading }
        let result = await Loadable<YearAttendance>.capture { try await Self.build(repo: repo, childId: childId) }
        if case .failed = result, state.value != nil { return }
        state = result
    }

    /// Academic years run April to March.
    static func yearStartMonth(now: String = IST.currentMonth()) -> String {
        let year = Int(now.prefix(4)) ?? 2026
        let month = Int(now.suffix(2)) ?? 4
        return "\(month >= 4 ? year : year - 1)-04"
    }

    private static func build(repo: any Repository, childId: String) async throws -> YearAttendance {
        let current = IST.currentMonth()
        var months: [String] = []
        var m = yearStartMonth()
        while m <= current { months.append(m); m = IST.addMonths(m, 1) }
        let results = try await withThrowingTaskGroup(of: (String, [AttendanceDay]).self) { group in
            for month in months { group.addTask { (month, try await repo.attendanceMonth(childId: childId, month: month)) } }
            var out: [String: [AttendanceDay]] = [:]
            for try await (month, days) in group { out[month] = days }
            return out
        }
        // Months with nothing marked are left out (apart from the current one), so the list stays short.
        let rows = months.map { MonthSummary(month: $0, stats: AttendanceStats(days: results[$0] ?? [])) }
            .filter { $0.stats.total > 0 || $0.month == current }
        let all = months.flatMap { results[$0] ?? [] }
        let start = Int(yearStartMonth().prefix(4)) ?? 2026
        return YearAttendance(label: "\(start)-\(String((start + 1) % 100).count == 1 ? "0" : "")\((start + 1) % 100)", months: rows, total: AttendanceStats(days: all))
    }
}
