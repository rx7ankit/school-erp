import Foundation

/// Everything the app needs from a backend. Views never talk to anything else.
protocol Repository: Sendable {
    func login(email: String, password: String) async throws -> AuthSession
    func changePassword(token: String, newPassword: String) async throws
    func children(token: String) async throws -> [Child]
    func today(childId: String) async throws -> TodayAttendance
    /// `month` is "yyyy-MM".
    func attendanceMonth(childId: String, month: String) async throws -> [AttendanceDay]
    func exams(childId: String) async throws -> [ExamSummary]
    func examDetail(childId: String, id: String) async throws -> ExamDetail
    /// School-level and class broadcasts merged, newest first.
    func updates(childId: String) async throws -> [Update]
    func markUpdatesRead(childId: String) async throws
    /// Active and previous (inactive) teachers of the child.
    func teacherThreads(childId: String) async throws -> [TeacherThread]
    func invoices(childId: String) async throws -> [Invoice]
    func notices() async throws -> [Notice]
    func calendar() async throws -> [CalendarEvent]
    /// Open requests for the child's class (answered ones included, closed ones hidden). Empty if the child has left.
    func feedbackRequests(childId: String) async throws -> [FeedbackRequest]
    /// Newest first. Pass the ids of the children whose notifications should be included.
    func notifications(childIds: [String]) async throws -> [AppNotification]
    func markAllRead(childIds: [String]) async throws
    /// `platform` is "ios". `token` is the hex APNs device token.
    func registerDevice(token: String, platform: String) async throws
    /// Parent's language, "en" or "hi". `PATCH /parent/preferences {language}`. Callers do not wait for it.
    func setLanguage(_ code: String) async throws
    /// Exams with their per-subject date sheet, for the child's class only.
    func examSchedules(childId: String) async throws -> [ExamSchedule]
    /// Newest first.
    func leaveRequests(childId: String) async throws -> [LeaveRequest]
    /// `from` / `to` are IST calendar dates ("2026-11-03"). Throws AppError for invalid input.
    func applyLeave(childId: String, from: String, to: String, half: LeaveHalf, reason: String) async throws -> LeaveRequest
    /// Only a pending request can be cancelled.
    func cancelLeave(id: String) async throws -> LeaveRequest
    func timetable(childId: String) async throws -> Timetable
    /// Sends all filled-in ratings at once. Returns the request, now answered.
    func submitFeedback(requestId: String, childId: String, ratings: [FeedbackRating]) async throws -> FeedbackRequest
}
