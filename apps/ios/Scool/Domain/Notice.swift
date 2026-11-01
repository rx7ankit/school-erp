import Foundation

struct Notice: Identifiable, Hashable {
    let id: String
    let title: String
    let body: String
    let publishedAt: String
}

enum CalendarKind: String {
    case holiday, exam, event

    var title: String {
        switch self {
        case .holiday: return L.t("cal.holiday")
        case .exam: return L.t("cal.exams")
        case .event: return L.t("cal.event")
        }
    }
}

struct CalendarEvent: Identifiable, Hashable {
    let id: String
    let title: String
    let fromOn: String
    let toOn: String
    let kind: CalendarKind
}
