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
        case .present: return L.t("att.status.present")
        case .absent: return L.t("att.status.absent")
        case .halfDayFirst: return L.t("att.status.half_first")
        case .halfDaySecond: return L.t("att.status.half_second")
        case .leave: return L.t("att.status.leave")
        case .holiday: return L.t("att.status.holiday")
        case .notMarked: return L.t("att.status.not_marked")
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
    let leave: Int
    /// Days that count towards the percentage (present, absent, half and leave).
    var total: Int { present + absent + half + leave }

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
        leave = l
        let total = p + a + h + l
        percentage = total == 0 ? 0 : (Double(p) + 0.5 * Double(h)) / Double(total) * 100
    }
}
