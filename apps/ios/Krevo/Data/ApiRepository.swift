import Foundation

/// The parent-side backend: every call goes to the Krevo API, and each response is mapped to the app's own models here,
/// so screens never see the wire format.
final class ApiRepository: Repository, @unchecked Sendable {
    let api: APIClient
    private let lock = NSLock()
    private var password = ""   // kept in memory only, for the forced "choose a new password" step

    init(api: APIClient) { self.api = api }

    // MARK: Sign in

    func login(email: String, password: String) async throws -> AuthSession {
        let token = try await api.login(email: email, password: password)
        let me: MeDTO = try await api.get("/auth/me")
        guard let kind = UserKind(rawValue: me.kind) else {
            api.signOut()
            throw ApiError("Platform owners sign in on the web.")
        }
        lock.lock(); self.password = password; lock.unlock()
        return AuthSession(accessToken: token.accessToken,
                           user: User(id: me.id, name: me.name, kind: kind, mustChangePassword: token.mustChangePassword))
    }

    func changePassword(token: String, newPassword: String) async throws {
        struct Body: Encodable { let currentPassword: String; let newPassword: String }
        lock.lock(); let current = password; lock.unlock()
        try await api.sendVoid("POST", "/auth/change-password", body: Body(currentPassword: current, newPassword: newPassword))
        lock.lock(); password = newPassword; lock.unlock()
    }

    // MARK: Children

    func children(token: String) async throws -> [Child] {
        let list: [ChildDTO] = try await api.get("/parent/children")
        var out: [Child] = []
        for c in list {
            async let detail: ChildDetailDTO = api.get("/parent/children/\(c.studentId)")
            async let teachers: [TeacherDTO] = api.get("/parent/children/\(c.studentId)/teachers")
            let (d, t) = try await (detail, teachers)
            out.append(Child(
                id: c.studentId, name: c.name, classLabel: c.classLabel ?? "", rollNo: c.rollNo ?? 0, scholarNo: c.scholarNo,
                dob: d.dob ?? "", classTeacher: t.first { $0.tag == "Class teacher" }?.name ?? "",
                guardians: d.guardians.map { Guardian(name: $0.name, relation: $0.relation, phone: $0.phone ?? "") },
                status: c.readOnly || c.status != "active" ? .left : .active, leftOn: nil))
        }
        return out
    }

    // MARK: Attendance

    func today(childId: String) async throws -> TodayAttendance {
        let on = IST.todayOn()
        let days = try await attendanceMonth(childId: childId, month: String(on.prefix(7)))
        return TodayAttendance(status: days.first { $0.on == on }?.status ?? .notMarked, markedAt: nil)
    }

    func attendanceMonth(childId: String, month: String) async throws -> [AttendanceDay] {
        let cal: CalendarDTO = try await api.get("/parent/children/\(childId)/attendance/calendar", query: ["month": month])
        return cal.days.map { d in
            let status: AttendanceStatus
            if d.holiday != nil { status = .holiday }
            else {
                switch d.status {
                case "full": status = .present
                case "absent": status = .absent
                case "leave": status = .leave
                case "half": status = d.firstHalf == "present" ? .halfDayFirst : .halfDaySecond
                default: status = .notMarked
                }
            }
            return AttendanceDay(on: d.dayOn, status: status)
        }
    }

    // MARK: Results

    func exams(childId: String) async throws -> [ExamSummary] {
        let rows: [ResultRowDTO] = try await api.get("/parent/children/\(childId)/results")
        return rows.map { ExamSummary(id: $0.exam.id, name: $0.exam.name, publishedAt: $0.publishedAt, percentage: $0.percentage ?? 0) }
    }

    func examDetail(childId: String, id: String) async throws -> ExamDetail {
        let r: ResultDetailDTO = try await api.get("/parent/children/\(childId)/results/\(id)")
        let subjects = r.papers.map { paper -> SubjectMark in
            let mark = r.marks.first { $0.subjectId == paper.subjectId }
            return SubjectMark(subject: paper.subject, marks: mark?.marksObtained ?? 0, max: paper.maxMarks, grade: mark?.absent == true ? "AB" : (mark?.grade ?? "–"))
        }
        return ExamDetail(id: r.exam.id, name: r.exam.name, publishedAt: r.publishedAt ?? "", subjects: subjects, remark: r.remark ?? "")
    }

    func examSchedules(childId: String) async throws -> [ExamSchedule] {
        let rows: [ScheduleDTO] = try await api.get("/parent/children/\(childId)/date-sheet")
        return rows.map { s in
            let days = s.items.map(\.paperOn).sorted()
            return ExamSchedule(id: s.id, name: s.name, classLabel: s.items.first?.className ?? "", fromOn: days.first ?? "", toOn: days.last ?? "",
                                papers: s.items.map { ExamPaper(id: $0.subjectId + $0.paperOn, subject: $0.subject, startAt: $0.startsAt) })
        }
    }

    // MARK: Updates, notices, calendar

    func updates(childId: String) async throws -> [Update] {
        let page: StaffPage<FeedItemDTO> = try await api.get("/parent/updates", query: ["student_id": childId, "limit": "100"])
        return page.items.map(Self.update)
    }

    func markUpdatesRead(childId: String) async throws {
        try await api.sendVoid("POST", "/parent/updates/read-all")
    }

    func notices() async throws -> [Notice] {
        let page: StaffPage<FeedItemDTO> = try await api.get("/parent/updates", query: ["limit": "100"])
        return page.items.filter { $0.scope == "school" }.map { Notice(id: $0.id, title: $0.title, body: $0.body, publishedAt: $0.createdAt) }
    }

    func calendar() async throws -> [CalendarEvent] {
        let rows: [HolidayDTO] = try await api.get("/parent/holidays")
        return rows.map { CalendarEvent(id: $0.id, title: $0.title, fromOn: $0.fromOn, toOn: $0.toOn, kind: CalendarKind(rawValue: $0.kind) ?? .event) }
    }

    private static func update(_ i: FeedItemDTO) -> Update {
        Update(id: i.id, kind: i.scope == "school" ? .school : .classBroadcast, tag: i.tag, sender: i.senderName,
               title: i.title, text: i.body, attachment: i.attachments.first?.filename, at: i.createdAt, isRead: i.isRead)
    }

    // MARK: Messages

    func teacherThreads(childId: String) async throws -> [TeacherThread] {
        let page: StaffPage<ThreadDTO> = try await api.get("/parent/threads", query: ["student_id": childId, "limit": "100"])
        return page.items.map { t in
            let isClassTeacher = t.tag == "Class teacher"
            return TeacherThread(id: t.id, teacher: t.teacherName, subject: isClassTeacher ? "" : t.tag, isClassTeacher: isClassTeacher,
                                 status: t.active ? .active : .inactive, lastText: t.lastMessagePreview ?? "", lastAt: t.lastMessageAt ?? "", unread: t.unread)
        }
    }

    // MARK: Fees

    func invoices(childId: String) async throws -> [Invoice] {
        let list: FeesDTO = try await api.get("/parent/children/\(childId)/fees")
        var out: [Invoice] = []
        for row in list.invoices {
            let d: InvoiceDetailDTO = try await api.get("/parent/children/\(childId)/fees/invoices/\(row.id)")
            let lines = d.items.map { item -> InvoiceLine in
                switch item.kind {
                case "concession": return InvoiceLine(title: item.description, amountPaise: -abs(item.amountPaise), kind: .discount)
                case "late_fee": return InvoiceLine(title: item.description, amountPaise: item.amountPaise, kind: .lateFee)
                case "previous_dues": return InvoiceLine(title: item.description, amountPaise: item.amountPaise, kind: .previousDues)
                default: return InvoiceLine(title: item.description, amountPaise: item.amountPaise)
                }
            }
            let payments = d.payments.map {
                Payment(id: $0.id, receiptNo: $0.receiptNo, mode: $0.mode, reference: $0.reference ?? "-", receivedBy: $0.receivedByName ?? "School office",
                        amountPaise: $0.amountPaise, at: $0.receivedAt, status: $0.status == "active" ? .active : .cancelled)
            }
            out.append(Invoice(id: d.id, no: d.invoiceNo, period: d.periodLabel, dueOn: d.dueOn, lines: lines, payments: payments))
        }
        return out
    }

    // MARK: Feedback

    func feedbackRequests(childId: String) async throws -> [FeedbackRequest] {
        let rows: [FeedbackDTO] = try await api.get("/parent/feedback")
        return rows.filter { $0.studentId == childId }.map { r in
            FeedbackRequest(
                id: r.requestId, title: r.title, closesOn: r.closesOn,
                targets: r.targets.map { FeedbackTarget(id: $0.targetId, teacher: $0.teacher, subject: $0.subject ?? "", isClassTeacher: $0.subject == nil) },
                ratings: r.targets.compactMap { t in t.myRating.map { FeedbackRating(targetId: t.targetId, rating: $0, comment: t.myComment) } })
        }
    }

    func submitFeedback(requestId: String, childId: String, ratings: [FeedbackRating]) async throws -> FeedbackRequest {
        struct Body: Encodable { let rating: Int; let comment: String? }
        for r in ratings {
            try await api.sendVoid("PUT", "/parent/feedback/targets/\(r.targetId)/children/\(childId)", body: Body(rating: r.rating, comment: r.comment))
        }
        guard let updated = try await feedbackRequests(childId: childId).first(where: { $0.id == requestId }) else { throw AppError.notFound }
        return updated
    }

    // MARK: Notifications

    func notifications(childIds: [String]) async throws -> [AppNotification] {
        let inbox: InboxDTO = try await api.get("/parent/notifications", query: ["limit": "100"])
        return inbox.items.map { n in
            var item = AppNotification(id: n.id, kind: Self.kind(n.kind), childId: n.studentId ?? childIds.first ?? "", childName: "", at: n.createdAt,
                                       isRead: n.isRead ?? (n.readAt != nil))
            item.serverTitle = n.title
            item.serverBody = n.body
            return item
        }.filter { childIds.isEmpty || childIds.contains($0.childId) }
    }

    func markAllRead(childIds: [String]) async throws {
        try await api.sendVoid("POST", "/parent/notifications/read-all")
    }

    func registerDevice(token: String, platform: String) async throws {
        struct Body: Encodable { let platform: String; let token: String }
        try await api.sendVoid("POST", "/parent/notifications/devices", body: Body(platform: platform, token: token))
    }

    func setLanguage(_ code: String) async throws {
        struct Body: Encodable { let language: String }
        try await api.sendVoid("PATCH", "/parent/preferences", body: Body(language: code))
    }

    private static func kind(_ raw: String) -> NotificationKind {
        switch raw {
        case "attendance_absent": return .attendanceAbsent
        case "attendance_present": return .attendancePresent
        case "fee_reminder", "fee_invoice", "fee_payment": return .feeReminder
        case "result": return .resultPublished
        case "exam": return .examDateSheet
        case "feedback": return .feedbackRequested
        case "message": return .message
        case "leave_decided": return .leaveApproved
        case "broadcast": return .broadcast
        default: return .notice
        }
    }

    // MARK: Leave

    func leaveRequests(childId: String) async throws -> [LeaveRequest] {
        let page: StaffPage<LeaveDTO> = try await api.get("/parent/children/\(childId)/leave", query: ["limit": "100"])
        return page.items.map(Self.leave)
    }

    func applyLeave(childId: String, from: String, to: String, half: LeaveHalf, reason: String) async throws -> LeaveRequest {
        if let problem = LeaveRules.validate(from: from, to: to, half: half, reason: reason, today: IST.todayOn()) { throw problem }
        struct Body: Encodable { let fromOn: String; let toOn: String; let half: String; let reason: String }
        let l: LeaveDTO = try await api.send("POST", "/parent/children/\(childId)/leave",
                                             body: Body(fromOn: from, toOn: to, half: half.rawValue, reason: reason.trimmingCharacters(in: .whitespacesAndNewlines)))
        return Self.leave(l)
    }

    func cancelLeave(id: String) async throws -> LeaveRequest {
        Self.leave(try await api.send("POST", "/parent/leave/\(id)/cancel"))
    }

    private static func leave(_ l: LeaveDTO) -> LeaveRequest {
        LeaveRequest(id: l.id, childId: l.studentId, fromOn: l.fromOn, toOn: l.toOn, half: LeaveHalf(rawValue: l.half) ?? .none, reason: l.reason,
                     status: LeaveStatus(rawValue: l.status) ?? .pending, decisionNote: l.decisionNote, createdAt: l.createdAt)
    }

    // MARK: Timetable

    func timetable(childId: String) async throws -> Timetable {
        let t: ChildTimetableDTO = try await api.get("/parent/children/\(childId)/timetable")
        let periods = t.periods.sorted { $0.number < $1.number }.map {
            Period(id: $0.number, label: String($0.number), start: String($0.startsAt.prefix(5)), end: String($0.endsAt.prefix(5)), isBreak: false)
        }
        let slots = t.slots.map { TimetableSlot(periodId: $0.periodNumber, weekday: $0.weekday, subject: $0.subjectName, teacher: $0.staffName) }
        let subs = t.today.compactMap { e in e.substituteName.map { Substitution(on: t.on, periodId: e.slot.periodNumber, teacher: $0) } }
        return Timetable(classLabel: t.classLabel, periods: periods, slots: slots, substitutions: subs)
    }
}
