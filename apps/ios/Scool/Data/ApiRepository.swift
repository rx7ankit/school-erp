import Foundation

/// Real backend client. Not implemented yet.
/// TODO: implement with URLSession against the FastAPI backend:
///   POST /auth/login {email,password} -> {access_token, user:{id,name,kind,must_change_password}}
/// and the remaining endpoints once they exist. Map `*_at` / `*_on` strings as-is (no date parsing here).
struct ApiRepository: Repository {
    let baseURL: URL

    func login(email: String, password: String) async throws -> AuthSession { throw AppError.notImplemented }
    func changePassword(token: String, newPassword: String) async throws { throw AppError.notImplemented }
    func children(token: String) async throws -> [Child] { throw AppError.notImplemented }
    func today(childId: String) async throws -> TodayAttendance { throw AppError.notImplemented }
    func attendanceMonth(childId: String, month: String) async throws -> [AttendanceDay] { throw AppError.notImplemented }
    func exams(childId: String) async throws -> [ExamSummary] { throw AppError.notImplemented }
    func examDetail(id: String) async throws -> ExamDetail { throw AppError.notImplemented }
    func updates(childId: String) async throws -> [Update] { throw AppError.notImplemented }
    func markUpdatesRead(childId: String) async throws { throw AppError.notImplemented }
    func teacherThreads(childId: String) async throws -> [TeacherThread] { throw AppError.notImplemented }
    func threadMessages(threadId: String) async throws -> [ThreadMessage] { throw AppError.notImplemented }
    func sendMessage(threadId: String, text: String) async throws -> ThreadMessage { throw AppError.notImplemented }
    func invoices(childId: String) async throws -> [Invoice] { throw AppError.notImplemented }
    func notices() async throws -> [Notice] { throw AppError.notImplemented }
    func calendar() async throws -> [CalendarEvent] { throw AppError.notImplemented }
    func notifications(childIds: [String]) async throws -> [AppNotification] { throw AppError.notImplemented }
    func markAllRead(childIds: [String]) async throws { throw AppError.notImplemented }
    func registerDevice(token: String, platform: String) async throws { throw AppError.notImplemented }
    /// TODO: PATCH /parent/preferences {language: "en" | "hi"} with the bearer token.
    func setLanguage(_ code: String) async throws { throw AppError.notImplemented }
    func examSchedules(childId: String) async throws -> [ExamSchedule] { throw AppError.notImplemented }
    func leaveRequests(childId: String) async throws -> [LeaveRequest] { throw AppError.notImplemented }
    func applyLeave(childId: String, from: String, to: String, half: LeaveHalf, reason: String) async throws -> LeaveRequest { throw AppError.notImplemented }
    func cancelLeave(id: String) async throws -> LeaveRequest { throw AppError.notImplemented }
    func timetable(childId: String) async throws -> Timetable { throw AppError.notImplemented }
    func feedbackRequests(childId: String) async throws -> [FeedbackRequest] { throw AppError.notImplemented }
    func submitFeedback(requestId: String, childId: String, ratings: [FeedbackRating]) async throws -> FeedbackRequest { throw AppError.notImplemented }
}
