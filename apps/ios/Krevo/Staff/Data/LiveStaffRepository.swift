import Foundation

/// The real backend. One method per screen need, each a single API call.
final class LiveStaffRepository: StaffRepository, @unchecked Sendable {
    let api: APIClient
    init(api: APIClient) { self.api = api }

    func me() async throws -> StaffMe { try await api.get("/auth/me") }

    /// Four steps, like a chat attachment: ask for a link, send the bytes, confirm, then make it this person's photo.
    func setPhoto(jpeg: Data?) async throws {
        struct SetBody: Encodable { let fileId: String? }
        guard let jpeg else {
            try await api.sendVoid("PUT", "/auth/me/photo", body: SetBody(fileId: nil))
            return
        }
        struct Ask: Encodable { let purpose: String; let filename: String; let contentType: String; let sizeBytes: Int }
        struct Link: Decodable { let id: String; let uploadUrl: String; let headers: [String: String] }
        let link: Link = try await api.send("POST", "/files/upload-url",
                                            body: Ask(purpose: "staff_photo", filename: "photo.jpg", contentType: "image/jpeg", sizeBytes: jpeg.count))
        try await api.upload(to: link.uploadUrl, data: jpeg, headers: link.headers)
        try await api.sendVoid("POST", "/files/\(link.id)/complete")
        try await api.sendVoid("PUT", "/auth/me/photo", body: SetBody(fileId: link.id))
    }
    func dashboard() async throws -> StaffDashboard { try await api.get("/dashboard") }

    func dayOverview(day: String) async throws -> StaffDayOverview {
        try await api.get("/attendance/overview", query: ["day_on": day])
    }

    func assignments(classId: String) async throws -> [StaffAssignmentRow] {
        let page: StaffPage<StaffAssignmentRow> = try await api.get("/academic/assignments", query: ["class_id": classId])
        return page.items
    }

    func subjects() async throws -> [StaffSubject] {
        let page: StaffPage<StaffSubject> = try await api.get("/academic/subjects")
        return page.items
    }

    func classes() async throws -> [StaffClass] {
        let page: StaffPage<StaffClass> = try await api.get("/academic/classes")
        return page.items.sorted { ($0.grade, $0.section) < ($1.grade, $1.section) }
    }

    func attendanceSheet(classId: String, day: String) async throws -> AttendanceSheet {
        try await api.get("/attendance/classes/\(classId)/sheet", query: ["day_on": day])
    }

    func saveAttendance(classId: String, day: String, records: [AttendanceRecord]) async throws -> AttendanceSheet {
        struct Body: Encodable { let records: [AttendanceRecord] }
        return try await api.send("PUT", "/attendance/classes/\(classId)/days/\(day)", body: Body(records: records))
    }

    func attendanceInsight(days: Int) async throws -> AttendanceInsight {
        let to = IST.todayOn()
        return try await api.get("/analytics/attendance", query: ["from_on": IST.addDays(to, -(days - 1)), "to_on": to])
    }

    func students(query: String, classId: String?, offset: Int) async throws -> StaffPage<StudentItem> {
        try await api.get("/students", query: [
            "q": query.isEmpty ? nil : query, "class_id": classId, "limit": "40", "offset": String(offset),
        ])
    }

    func student(id: String) async throws -> StudentDetail { try await api.get("/students/\(id)") }

    func leaves(status: String?) async throws -> [StaffLeave] {
        let page: StaffPage<StaffLeave> = try await api.get("/leave", query: ["status": status, "limit": "100"])
        return page.items
    }

    func decideLeave(id: String, approve: Bool, note: String) async throws -> StaffLeave {
        struct Body: Encodable { let decision: String; let note: String? }
        return try await api.send("POST", "/leave/\(id)/decision", body: Body(decision: approve ? "approve" : "reject", note: note.isEmpty ? nil : note))
    }

    func myDay(on: String) async throws -> StaffDay { try await api.get("/timetable/me/day", query: ["on": on]) }

    func broadcasts() async throws -> [Broadcast] {
        let page: StaffPage<Broadcast> = try await api.get("/messaging/broadcasts", query: ["limit": "30"])
        return page.items
    }

    func broadcastPage(offset: Int) async throws -> StaffPage<Broadcast> {
        try await api.get("/messaging/broadcasts", query: ["limit": "20", "offset": String(offset)])
    }

    func postBroadcast(_ draft: BroadcastDraft) async throws -> Broadcast {
        try await api.send("POST", "/messaging/broadcasts", body: draft)
    }

    func threads() async throws -> [StaffThread] {
        let page: StaffPage<StaffThread> = try await api.get("/messaging/threads", query: ["limit": "100"])
        return page.items.sorted { ($0.lastMessageAt ?? "") > ($1.lastMessageAt ?? "") }
    }

    func staff(query: String) async throws -> [StaffMember] {
        let page: StaffPage<StaffMember> = try await api.get("/staff", query: ["q": query.isEmpty ? nil : query])
        return page.items
    }

    func feesSummary() async throws -> FeesSummary { try await api.get("/analytics/fees") }

    func dues(query: String, offset: Int) async throws -> DuesPage {
        try await api.get("/fees/reports/dues", query: ["q": query.isEmpty ? nil : query, "limit": "40", "offset": String(offset)])
    }

    func openThread(studentId: String, subjectId: String?) async throws -> StaffThread {
        struct Body: Encodable { let studentId: String; let subjectId: String? }
        return try await api.send("POST", "/messaging/threads", body: Body(studentId: studentId, subjectId: subjectId))
    }

    func homeLayout() async throws -> HomeLayout { try await api.get("/home/layout") }

    func librarySummary() async throws -> LibrarySummary { try await api.get("/library/summary") }

    func books(query: String, offset: Int) async throws -> StaffPage<LibraryBook> {
        try await api.get("/library/books", query: ["q": query.isEmpty ? nil : query, "limit": "30", "offset": String(offset)])
    }

    func overdueLoans(offset: Int) async throws -> StaffPage<LibraryLoan> {
        try await api.get("/library/overdue", query: ["limit": "30", "offset": String(offset)])
    }

    func accessOptions() async throws -> AccessOptions { try await api.get("/staff/access-options") }

    func setDesignation(staffId: String, designation: String) async throws -> StaffMember {
        struct Body: Encodable { let designation: String }
        return try await api.send("PATCH", "/staff/\(staffId)", body: Body(designation: designation))
    }

    func setPermissions(staffId: String, permissions: [String]) async throws -> StaffMember {
        struct Body: Encodable { let permissions: [String] }
        return try await api.send("PUT", "/staff/\(staffId)/permissions", body: Body(permissions: permissions))
    }

    func addStaff(name: String, email: String, designation: String, permissions: [String], sendLogin: Bool) async throws -> StaffMember {
        struct Body: Encodable { let name: String; let email: String; let designation: String; let permissions: [String]; let sendLogin: Bool }
        return try await api.send("POST", "/staff", body: Body(name: name, email: email, designation: designation, permissions: permissions, sendLogin: sendLogin))
    }

    func sendLogin(staffId: String) async throws {
        try await api.sendVoid("POST", "/staff/\(staffId)/send-login")
    }

    func signOut() { api.signOut() }
}
