import Foundation

/// Everything the staff screens need from a backend. Screens never talk to anything else, so the same
/// screens run on the live API and on the offline demo data.
protocol StaffRepository: Sendable {
    func me() async throws -> StaffMe
    func dashboard() async throws -> StaffDashboard
    func classes() async throws -> [StaffClass]

    func attendanceSheet(classId: String, day: String) async throws -> AttendanceSheet
    func saveAttendance(classId: String, day: String, records: [AttendanceRecord]) async throws -> AttendanceSheet

    func students(query: String, classId: String?, offset: Int) async throws -> StaffPage<StudentItem>
    func student(id: String) async throws -> StudentDetail

    /// `status` is "pending", "approved", "rejected" or nil for all.
    func leaves(status: String?) async throws -> [StaffLeave]
    func decideLeave(id: String, approve: Bool, note: String) async throws -> StaffLeave

    func myDay(on: String) async throws -> StaffDay

    func broadcasts() async throws -> [Broadcast]
    func postBroadcast(_ draft: BroadcastDraft) async throws -> Broadcast

    func staff(query: String) async throws -> [StaffMember]

    func feesSummary() async throws -> FeesSummary
    func dues(query: String, offset: Int) async throws -> DuesPage

    func signOut()
}

/// What this person may see and do. Admin bypasses everything; a teacher is limited to assigned classes.
struct StaffAccess {
    let me: StaffMe

    var isAdmin: Bool { me.isAdmin }
    var canSeeFees: Bool { isAdmin || me.permissions.contains("fees.manage") }
    var canSeeStaff: Bool { isAdmin || me.permissions.contains("staff.manage") }
    /// Class teacher of at least one class (or admin): may mark attendance and decide leave.
    var canMarkAttendance: Bool { isAdmin || me.assignments.contains { $0.role == "class_teacher" } }
    var roleTitle: String { isAdmin ? "Admin" : (me.designation?.isEmpty == false ? me.designation! : "Teacher") }

    func classIdsToMark(all: [String]) -> [String] {
        if isAdmin { return all }
        return me.assignments.filter { $0.role == "class_teacher" }.map(\.classId)
    }
}
