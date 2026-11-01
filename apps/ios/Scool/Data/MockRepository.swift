import Foundation

/// In-memory backend for demos. An actor so the mutable state is safe.
actor MockRepository: Repository {
    private var passwords: [String: String] = [:]      // email -> overridden password
    private var sent: [String: [ChatMessage]] = [:]    // threadId -> messages sent in this run
    private let latency: UInt64 = 250_000_000          // 0.25 s, so loading states are visible

    private func pause() async {
        try? await Task.sleep(nanoseconds: latency)
    }

    // MARK: Auth

    func login(email: String, password: String) async throws -> AuthSession {
        await pause()
        let key = email.trimmingCharacters(in: .whitespaces).lowercased()
        guard let account = MockData.accounts[key] else { throw AppError.invalidCredentials }
        let expected = passwords[key] ?? account.password
        guard password == expected else { throw AppError.invalidCredentials }
        // Once the password was changed in this run, the temporary-password flag is cleared.
        let mustChange = account.user.mustChangePassword && passwords[key] == nil
        let user = User(id: account.user.id, name: account.user.name, kind: account.user.kind, mustChangePassword: mustChange)
        return AuthSession(accessToken: "mock-token:" + key, user: user)
    }

    func changePassword(token: String, newPassword: String) async throws {
        await pause()
        let key = token.replacingOccurrences(of: "mock-token:", with: "")
        guard MockData.accounts[key] != nil else { throw AppError.notFound }
        passwords[key] = newPassword
    }

    func children(token: String) async throws -> [Child] {
        await pause()
        let key = token.replacingOccurrences(of: "mock-token:", with: "")
        return MockData.accounts[key]?.children ?? []
    }

    // MARK: Attendance

    func today(childId: String) async throws -> TodayAttendance {
        await pause()
        return MockData.today(childId: childId)
    }

    func attendanceMonth(childId: String, month: String) async throws -> [AttendanceDay] {
        await pause()
        return MockData.attendanceMonth(childId: childId, month: month)
    }

    // MARK: Results

    func exams(childId: String) async throws -> [ExamSummary] {
        await pause()
        return MockData.exams(childId: childId)
    }

    func examDetail(id: String) async throws -> ExamDetail {
        await pause()
        guard let detail = MockData.examDetail(id: id) else { throw AppError.notFound }
        return detail
    }

    // MARK: Messages

    func broadcasts(childId: String) async throws -> [Broadcast] {
        await pause()
        return MockData.broadcasts(childId: childId)
    }

    private func allMessages(_ threadId: String) -> [ChatMessage] {
        (MockData.seedMessages[threadId] ?? []) + (sent[threadId] ?? [])
    }

    func threads(childId: String) async throws -> [MessageThread] {
        await pause()
        var out: [MessageThread] = []
        for seed in MockData.threadSeeds where seed.childId == childId {
            let last = allMessages(seed.id).last
            out.append(MessageThread(
                id: seed.id, teacher: seed.teacher, role: seed.role,
                lastText: last?.text ?? "No messages yet", lastAt: last?.at ?? ""))
        }
        return out
    }

    func messages(threadId: String) async throws -> [ChatMessage] {
        await pause()
        return allMessages(threadId)
    }

    func send(threadId: String, text: String) async throws -> ChatMessage {
        await pause()
        let message = ChatMessage(id: UUID().uuidString, mine: true, text: text, at: IST.nowISO())
        sent[threadId, default: []].append(message)
        return message
    }

    // MARK: Fees, notices, calendar

    func invoices(childId: String) async throws -> [Invoice] {
        await pause()
        return MockData.invoices(childId: childId)
    }

    func notices() async throws -> [Notice] {
        await pause()
        return MockData.notices
    }

    func calendar() async throws -> [CalendarEvent] {
        await pause()
        return MockData.calendar
    }
}
