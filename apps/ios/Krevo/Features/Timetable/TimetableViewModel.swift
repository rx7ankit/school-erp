import Foundation
import Observation

@Observable
@MainActor
final class TimetableViewModel {
    var timetable: Loadable<Timetable> = .loading

    func load(repo: any Repository, childId: String) async {
        timetable = await Loadable<Timetable>.capture { try await repo.timetable(childId: childId) }
    }

    /// Today's weekday as 1 (Monday) ... 6 (Saturday); nil on Sunday. Computed from the IST date.
    static func todayWeekday() -> Int? {
        let index = IST.weekdayIndex(IST.todayOn())      // 0 = Sunday
        return index == 0 ? nil : index
    }
}
