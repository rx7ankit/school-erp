import Foundation
import Observation

@Observable
@MainActor
final class HomeViewModel {
    var today: Loadable<TodayAttendance> = .loading
    var invoices: Loadable<[Invoice]> = .loading
    var exams: Loadable<[ExamSummary]> = .loading
    var notices: Loadable<[Notice]> = .loading

    func load(repo: any Repository, childId: String) async {
        async let t = Loadable<TodayAttendance>.capture { try await repo.today(childId: childId) }
        async let i = Loadable<[Invoice]>.capture { try await repo.invoices(childId: childId) }
        async let e = Loadable<[ExamSummary]>.capture { try await repo.exams(childId: childId) }
        async let n = Loadable<[Notice]>.capture { try await repo.notices() }
        today = await t
        invoices = await i
        exams = await e
        notices = await n
    }

    /// First invoice that still has money due, earliest due date first.
    static func nextDue(_ invoices: [Invoice]) -> Invoice? {
        invoices.filter { $0.duePaise > 0 }.sorted { $0.dueOn < $1.dueOn }.first
    }

    static func latestExam(_ exams: [ExamSummary]) -> ExamSummary? {
        exams.max { $0.publishedAt < $1.publishedAt }
    }

    static func latestNotice(_ notices: [Notice]) -> Notice? {
        notices.max { $0.publishedAt < $1.publishedAt }
    }

    static func greeting() -> String {
        let h = IST.currentHour()
        if h < 12 { return "Good morning," }
        if h < 17 { return "Good afternoon," }
        return "Good evening,"
    }
}
