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
    func broadcasts(childId: String) async throws -> [Broadcast] { throw AppError.notImplemented }
    func threads(childId: String) async throws -> [MessageThread] { throw AppError.notImplemented }
    func messages(threadId: String) async throws -> [ChatMessage] { throw AppError.notImplemented }
    func send(threadId: String, text: String) async throws -> ChatMessage { throw AppError.notImplemented }
    func invoices(childId: String) async throws -> [Invoice] { throw AppError.notImplemented }
    func notices() async throws -> [Notice] { throw AppError.notImplemented }
    func calendar() async throws -> [CalendarEvent] { throw AppError.notImplemented }
}
