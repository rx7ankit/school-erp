import Foundation
import Observation

@Observable
@MainActor
final class NoticesViewModel {
    enum Mode: String, CaseIterable, Identifiable {
        case notices, calendar, exams
        var id: String { rawValue }
        var title: String {
            switch self {
            case .notices: return L.t("notices.notices")
            case .calendar: return L.t("notices.calendar")
            case .exams: return L.t("notices.exams")
            }
        }
    }

    var mode: Mode
    var schedules: Loadable<[ExamSchedule]> = .loading

    init(mode: Mode = .notices) {
        self.mode = mode
    }
    var notices: Loadable<[Notice]> = .loading
    var events: Loadable<[CalendarEvent]> = .loading

    func load(repo: any Repository, childId: String) async {
        async let n = Loadable<[Notice]>.capture { try await repo.notices() }
        async let c = Loadable<[CalendarEvent]>.capture { try await repo.calendar() }
        async let x = Loadable<[ExamSchedule]>.capture { try await repo.examSchedules(childId: childId) }
        let noticeResult = await n
        let eventResult = await c
        let scheduleResult = await x
        if let list = scheduleResult.value {
            schedules = .loaded(list.sorted { $0.fromOn < $1.fromOn })
        } else {
            schedules = scheduleResult
        }
        if let list = noticeResult.value {
            notices = .loaded(list.sorted { $0.publishedAt > $1.publishedAt })
        } else {
            notices = noticeResult
        }
        if let list = eventResult.value {
            events = .loaded(list.sorted { $0.fromOn < $1.fromOn })
        } else {
            events = eventResult
        }
    }
}
