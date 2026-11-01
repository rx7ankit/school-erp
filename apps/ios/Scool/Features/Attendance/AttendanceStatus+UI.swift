import SwiftUI

extension AttendanceStatus {
    var tone: Pill.Tone {
        switch self {
        case .present: return .success
        case .absent: return .danger
        case .halfDayFirst, .halfDaySecond: return .warning
        case .leave, .holiday, .notMarked: return .neutral
        }
    }
}
