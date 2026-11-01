import Foundation

enum AttendanceStatus: String {
    case present
    case absent
    case halfDayFirst      // half day, first half
    case halfDaySecond     // half day, second half
    case leave
    case holiday
    case notMarked

    var title: String {
        switch self {
        case .present: return "Present"
        case .absent: return "Absent"
        case .halfDayFirst: return "Half day, first half"
        case .halfDaySecond: return "Half day, second half"
        case .leave: return "On leave"
        case .holiday: return "Holiday"
        case .notMarked: return "Not marked yet"
        }
    }
}

struct TodayAttendance {
    let status: AttendanceStatus
    let markedAt: String?   // UTC ISO timestamp
}

struct AttendanceDay: Identifiable {
    let on: String          // date-only
    let status: AttendanceStatus
    var id: String { on }
}

struct AttendanceStats {
    let percentage: Double
    let present: Int
    let absent: Int
    let half: Int

    /// Half day counts 0.5. Leave days count in the total but earn nothing.
    init(days: [AttendanceDay]) {
        var p = 0, a = 0, h = 0, l = 0
        for d in days {
            switch d.status {
            case .present: p += 1
            case .absent: a += 1
            case .halfDayFirst, .halfDaySecond: h += 1
            case .leave: l += 1
            case .holiday, .notMarked: break
            }
        }
        present = p
        absent = a
        half = h
        let total = p + a + h + l
        percentage = total == 0 ? 0 : (Double(p) + 0.5 * Double(h)) / Double(total) * 100
    }
}
