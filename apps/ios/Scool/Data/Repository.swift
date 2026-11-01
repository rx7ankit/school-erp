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
    func examDetail(id: String) async throws -> ExamDetail
    func broadcasts(childId: String) async throws -> [Broadcast]
    func threads(childId: String) async throws -> [MessageThread]
    func messages(threadId: String) async throws -> [ChatMessage]
    func send(threadId: String, text: String) async throws -> ChatMessage
    func invoices(childId: String) async throws -> [Invoice]
    func notices() async throws -> [Notice]
    func calendar() async throws -> [CalendarEvent]
}
