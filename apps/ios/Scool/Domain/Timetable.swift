import Foundation

/// One row of the grid. Times are IST clock text such as "09:00" and are never converted.
struct Period: Identifiable, Hashable {
    let id: Int
    let label: String           // "1", "2", "Break"
    let start: String           // "09:00"
    let end: String             // "09:40"
    let isBreak: Bool
}

/// One cell: a subject and teacher on a weekday (1 = Monday ... 6 = Saturday) in a period.
struct TimetableSlot: Hashable {
    let periodId: Int
    let weekday: Int
    let subject: String
    let teacher: String
}

/// A teacher change for one period on one date (shown for today).
struct Substitution: Hashable {
    let on: String              // date-only
    let periodId: Int
    let teacher: String         // the substitute
}

struct Timetable {
    let classLabel: String
    let periods: [Period]
    let slots: [TimetableSlot]
    let substitutions: [Substitution]

    func slot(period: Int, weekday: Int) -> TimetableSlot? {
        slots.first { $0.periodId == period && $0.weekday == weekday }
    }
}
