import Foundation
import Observation

@Observable
@MainActor
final class AttendanceViewModel {
    var month = IST.currentMonth()     // "yyyy-MM"
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
