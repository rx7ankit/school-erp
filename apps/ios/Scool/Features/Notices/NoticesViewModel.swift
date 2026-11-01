import Foundation
import Observation

@Observable
@MainActor
final class NoticesViewModel {
    enum Mode: String, CaseIterable, Identifiable {
        case notices = "Notices"
        case calendar = "Calendar"
        var id: String { rawValue }
    }

    var mode: Mode = .notices
    var notices: Loadable<[Notice]> = .loading
    var events: Loadable<[CalendarEvent]> = .loading

    func load(repo: any Repository) async {
        async let n = Loadable<[Notice]>.capture { try await repo.notices() }
        async let c = Loadable<[CalendarEvent]>.capture { try await repo.calendar() }
        let noticeResult = await n
        let eventResult = await c
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
