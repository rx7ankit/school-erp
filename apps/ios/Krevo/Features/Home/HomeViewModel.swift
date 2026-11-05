import Foundation
import Observation

@Observable
@MainActor
final class HomeViewModel {
    var today: Loadable<TodayAttendance> = .loading
    var invoices: Loadable<[Invoice]> = .loading
    var exams: Loadable<[ExamSummary]> = .loading
    var notices: Loadable<[Notice]> = .loading
    var week: Loadable<[WeekDay]> = .loading
    var timetable: Loadable<Timetable> = .loading
    /// A teacher message the parent has not opened yet: who sent the newest one, and how many threads wait.
    var newMessage: (teacher: String, count: Int)?
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
        async let w = Loadable<[WeekDay]>.capture { try await Self.loadWeek(repo: repo, childId: childId) }
        async let tt = Loadable<Timetable>.capture { try await repo.timetable(childId: childId) }
        week = await w
        timetable = await tt
        today = await t
        invoices = await i
        exams = await e
        notices = await n
        let notifications = (try? await repo.notifications(childIds: childIds)) ?? []
        let threads = (try? await repo.teacherThreads(childId: childId)) ?? []
        let waiting = threads.filter { $0.unread > 0 && $0.isActive }
        if let newest = waiting.max(by: { $0.lastAt < $1.lastAt }) {
            newMessage = (newest.teacher, waiting.reduce(0) { $0 + $1.unread })
        } else {
            newMessage = nil
        }
        hasUnread = notifications.contains { !$0.isRead && $0.category.isEnabled }
        promotion = Self.activePromotion(notifications, childId: childId)
        if hasLeft {
            pendingFeedback = []
        } else {
            let all = (try? await repo.feedbackRequests(childId: childId)) ?? []
            pendingFeedback = all.filter { !$0.isAnswered }.sorted { $0.closesOn < $1.closesOn }
        }
    }

    /// One cell of the "This week" strip.
    struct WeekDay: Identifiable, Hashable {
        let on: String
        let status: AttendanceStatus
        let isToday: Bool
        let isFuture: Bool
        var id: String { on }
    }

    /// Monday to Saturday of this week, with each day's attendance. Looks up every month the week touches.
    static func loadWeek(repo: any Repository, childId: String) async throws -> [WeekDay] {
        let today = IST.todayOn()
        let dates = IST.schoolWeek(containing: today)
        var byDay: [String: AttendanceStatus] = [:]
        for month in Set(dates.map { String($0.prefix(7)) }) {
            for day in try await repo.attendanceMonth(childId: childId, month: month) { byDay[day.on] = day.status }
        }
        return dates.map { WeekDay(on: $0, status: byDay[$0] ?? .notMarked, isToday: $0 == today, isFuture: $0 > today) }
    }

    /// Today's periods in order, from the class timetable. Sunday has none.
    static func todaysPeriods(_ t: Timetable) -> [(period: Period, slot: TimetableSlot, cover: String?)] {
        let today = IST.todayOn()
        let weekday = IST.weekdayIndex(today)   // 0 = Sunday, 1 = Monday ...
        guard weekday != 0 else { return [] }
        return t.periods.filter { !$0.isBreak }.compactMap { p in
            guard let slot = t.slot(period: p.id, weekday: weekday) else { return nil }
            let cover = t.substitutions.first { $0.on == today && $0.periodId == p.id }?.teacher
            return (p, slot, cover)
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

    /// The newest five, newest first: what the Home slider pages through.
    static func latestNotices(_ notices: [Notice], limit: Int = 5) -> [Notice] {
        Array(notices.sorted { $0.publishedAt > $1.publishedAt }.prefix(limit))
    }

    static func greeting() -> String {
        let h = IST.currentHour()
        if h < 12 { return L.t("home.morning") }
        if h < 17 { return L.t("home.afternoon") }
        return L.t("home.evening")
    }
}
