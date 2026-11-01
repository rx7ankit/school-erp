import Foundation

/// In-memory backend for demos. An actor so the mutable state is safe.
actor MockRepository: Repository {
    private var passwords: [String: String] = [:]      // email -> overridden password
    private var sent: [String: [ChatMessage]] = [:]    // threadId -> messages sent in this run
    private var feedbackDone: [String: [FeedbackRating]] = [:]  // "requestId|childId" -> ratings
    private var readNotifications: Set<String> = []
    private var leaveStore: [String: [LeaveRequest]] = [:]   // childId -> requests (seeded on first use)
    private var registeredToken: String?
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
                lastText: last?.text ?? "", lastAt: last?.at ?? ""))
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

    // MARK: Notifications, device, exam date sheet

    func notifications(childIds: [String]) async throws -> [AppNotification] {
        await pause()
        var all: [AppNotification] = []
        for id in childIds {
            for var item in MockData.notifications(childId: id) {
                if readNotifications.contains(item.id) { item.isRead = true }
                all.append(item)
            }
        }
        return all.sorted { $0.at > $1.at }
    }

    func markAllRead(childIds: [String]) async throws {
        await pause()
        for id in childIds {
            for item in MockData.notifications(childId: id) { readNotifications.insert(item.id) }
        }
    }

    func registerDevice(token: String, platform: String) async throws {
        registeredToken = token   // a real backend would store token + platform for this parent
    }

    func examSchedules(childId: String) async throws -> [ExamSchedule] {
        await pause()
        return MockData.examSchedules(childId: childId)
    }

    // MARK: Leave, timetable

    private func leaves(for childId: String) -> [LeaveRequest] {
        if let existing = leaveStore[childId] { return existing }
        let seeded = MockData.leaveRequests(childId: childId)
        leaveStore[childId] = seeded
        return seeded
    }

    func leaveRequests(childId: String) async throws -> [LeaveRequest] {
        await pause()
        return leaves(for: childId).sorted { $0.createdAt > $1.createdAt }
    }

    func applyLeave(childId: String, from: String, to: String, half: LeaveHalf, reason: String) async throws -> LeaveRequest {
        await pause()
        if MockData.isLeft(childId: childId) { throw AppError.leaveLeftSchool }
        if let problem = LeaveRules.validate(from: from, to: to, half: half, reason: reason, today: IST.todayOn()) {
            throw problem
        }
        let request = LeaveRequest(
            id: "lv-" + UUID().uuidString, childId: childId, fromOn: from, toOn: to, half: half,
            reason: reason.trimmingCharacters(in: .whitespacesAndNewlines),
            status: .pending, decisionNote: nil, createdAt: IST.nowISO())
        leaveStore[childId] = [request] + leaves(for: childId)
        return request
    }

    func cancelLeave(id: String) async throws -> LeaveRequest {
        await pause()
        for (childId, list) in leaveStore {
            guard let index = list.firstIndex(where: { $0.id == id }) else { continue }
            guard list[index].status == .pending else { throw AppError.leaveNotPending }
            var updated = list
            updated[index].status = .cancelled
            leaveStore[childId] = updated
            return updated[index]
        }
        throw AppError.notFound
    }

    func timetable(childId: String) async throws -> Timetable {
        await pause()
        return MockData.timetable(childId: childId)
    }

    // MARK: Feedback

    func feedbackRequests(childId: String) async throws -> [FeedbackRequest] {
        await pause()
        return MockData.feedbackRequests(childId: childId).map { request in
            guard let done = feedbackDone[request.id + "|" + childId] else { return request }
            return request.answered(with: done)
        }
    }

    func submitFeedback(requestId: String, childId: String, ratings: [FeedbackRating]) async throws -> FeedbackRequest {
        await pause()
        guard let request = MockData.feedbackRequests(childId: childId).first(where: { $0.id == requestId }) else {
            throw AppError.feedbackUnavailable
        }
        let key = requestId + "|" + childId
        let valid = ratings.filter { rating in
            (1...5).contains(rating.rating) && request.targets.contains(where: { $0.id == rating.targetId })
        }
        guard !valid.isEmpty, !request.isAnswered, feedbackDone[key] == nil else { throw AppError.feedbackUnavailable }
        let clean = valid.map { item in
            FeedbackRating(targetId: item.targetId, rating: item.rating,
                           comment: item.comment.map { String($0.prefix(Feedback.maxCommentLength)) })
        }
        feedbackDone[key] = clean
        return request.answered(with: clean)
    }
}
