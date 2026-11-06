import Foundation

/// Everything the staff screens need from a backend. Screens never talk to anything else, so the same
/// screens stay independent of the wire format.
protocol StaffRepository: Sendable {
    func me() async throws -> StaffMe
    /// Uploads a JPEG as this person's photo (nil removes it).
    func setPhoto(jpeg: Data?) async throws
    func dashboard() async throws -> StaffDashboard
    func classes() async throws -> [StaffClass]
    /// Every class this person can see on one date, with its attendance percentage.
    func dayOverview(day: String) async throws -> StaffDayOverview
    func assignments(classId: String) async throws -> [StaffAssignmentRow]
    func subjects() async throws -> [StaffSubject]

    func attendanceSheet(classId: String, day: String) async throws -> AttendanceSheet
    func saveAttendance(classId: String, day: String, records: [AttendanceRecord]) async throws -> AttendanceSheet

    /// Daily attendance percentage for the last `days` days, scoped to what this person may see.
    func attendanceInsight(days: Int) async throws -> AttendanceInsight

    func students(query: String, classId: String?, offset: Int) async throws -> StaffPage<StudentItem>
    func student(id: String) async throws -> StudentDetail

    /// `status` is "pending", "approved", "rejected" or nil for all.
    func leaves(status: String?) async throws -> [StaffLeave]
    func decideLeave(id: String, approve: Bool, note: String) async throws -> StaffLeave

    func myDay(on: String) async throws -> StaffDay

    func broadcasts() async throws -> [Broadcast]
    func postBroadcast(_ draft: BroadcastDraft) async throws -> Broadcast

    func threads() async throws -> [StaffThread]

    func staff(query: String) async throws -> [StaffMember]

    func feesSummary() async throws -> FeesSummary
    func dues(query: String, offset: Int) async throws -> DuesPage

    func signOut()
}

/// What this person may see and do. Admin bypasses everything; a teacher is limited to assigned classes.
struct StaffAccess {
    let me: StaffMe

    #if DEBUG
    /// Development only: launch the app with `-KrevoPreview subject` (a teacher with no extra permissions) or
    /// `-KrevoPreview classTeacher` to see exactly what that person would see, using any account. Not in release builds.
    private static let preview: String? = {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-KrevoPreview"), i + 1 < args.count else { return nil }
        return args[i + 1]
    }()
    #endif

    var isAdmin: Bool {
        #if DEBUG
        if Self.preview != nil { return false }
        #endif
        return me.isAdmin
    }
    var canSeeFees: Bool {
        #if DEBUG
        if Self.preview != nil { return false }
        #endif
        return isAdmin || me.permissions.contains("fees.manage")
    }
    var canSeeStaff: Bool {
        #if DEBUG
        if Self.preview != nil { return false }
        #endif
        return isAdmin || me.permissions.contains("staff.manage")
    }
    /// Class teacher of at least one class (or admin): may mark attendance and decide leave.
    var canMarkAttendance: Bool {
        #if DEBUG
        if let p = Self.preview { return p == "classTeacher" }
        #endif
        return isAdmin || me.assignments.contains { $0.role == "class_teacher" }
    }
    var roleTitle: String { isAdmin ? "Admin" : (me.designation?.isEmpty == false ? me.designation! : "Teacher") }

    func classIdsToMark(all: [String]) -> [String] {
        if isAdmin { return all }
        return me.assignments.filter { $0.role == "class_teacher" }.map(\.classId)
    }
}
