import Foundation
import Observation

@Observable
@MainActor
final class HomeViewModel {
    var today: Loadable<TodayAttendance> = .loading
    var invoices: Loadable<[Invoice]> = .loading
    var exams: Loadable<[ExamSummary]> = .loading
    var notices: Loadable<[Notice]> = .loading
    /// Feedback requests still waiting for an answer. Empty on error or when the child has left.
    var pendingFeedback: [FeedbackRequest] = []

    func load(repo: any Repository, childId: String, hasLeft: Bool) async {
        async let t = Loadable<TodayAttendance>.capture { try await repo.today(childId: childId) }
        async let i = Loadable<[Invoice]>.capture { try await repo.invoices(childId: childId) }
        async let e = Loadable<[ExamSummary]>.capture { try await repo.exams(childId: childId) }
        async let n = Loadable<[Notice]>.capture { try await repo.notices() }
        today = await t
        invoices = await i
        exams = await e
        notices = await n
        if hasLeft {
            pendingFeedback = []
        } else {
            let all = (try? await repo.feedbackRequests(childId: childId)) ?? []
            pendingFeedback = all.filter { !$0.isAnswered }.sorted { $0.closesOn < $1.closesOn }
        }
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
