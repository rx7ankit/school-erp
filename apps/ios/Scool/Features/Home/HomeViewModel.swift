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
    /// Any unread notification for any of the parent's children (drives the dot on the bell).
    var hasUnread = false
    /// Congratulations card: a promotion or completion of the selected child in the last 14 days, not dismissed.
    var promotion: AppNotification?

    func load(repo: any Repository, childId: String, childIds: [String], hasLeft: Bool) async {
        async let t = Loadable<TodayAttendance>.capture { try await repo.today(childId: childId) }
        async let i = Loadable<[Invoice]>.capture { try await repo.invoices(childId: childId) }
        async let e = Loadable<[ExamSummary]>.capture { try await repo.exams(childId: childId) }
        async let n = Loadable<[Notice]>.capture { try await repo.notices() }
        today = await t
        invoices = await i
        exams = await e
        notices = await n
        let notifications = (try? await repo.notifications(childIds: childIds)) ?? []
        hasUnread = notifications.contains { !$0.isRead && $0.category.isEnabled }
        promotion = Self.activePromotion(notifications, childId: childId)
        if hasLeft {
            pendingFeedback = []
        } else {
            let all = (try? await repo.feedbackRequests(childId: childId)) ?? []
            pendingFeedback = all.filter { !$0.isAnswered }.sorted { $0.closesOn < $1.closesOn }
        }
    }

    private static func dismissKey(_ id: String) -> String { "promoDismissed." + id }

    static func activePromotion(_ list: [AppNotification], childId: String) -> AppNotification? {
        list.filter { item in
            item.childId == childId && item.isCelebration
                && (IST.daysSince(item.at) ?? Int.max) <= 14
                && !UserDefaults.standard.bool(forKey: dismissKey(item.id))
        }.max { $0.at < $1.at }
    }

    /// Remembered per child and promotion (the notification id contains both).
    func dismissPromotion() {
        guard let current = promotion else { return }
        UserDefaults.standard.set(true, forKey: Self.dismissKey(current.id))
        promotion = nil
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
        if h < 12 { return L.t("home.morning") }
        if h < 17 { return L.t("home.afternoon") }
        return L.t("home.evening")
    }
}
