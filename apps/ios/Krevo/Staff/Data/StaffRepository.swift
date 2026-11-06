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
    func editBroadcast(id: String, title: String, body: String, attachmentIds: [String]) async throws -> Broadcast
    func deleteBroadcast(id: String) async throws
    /// One page of notices, newest first.
    func broadcastPage(offset: Int) async throws -> StaffPage<Broadcast>

    func threads() async throws -> [StaffThread]
    /// Starts, or reopens, my conversation with a child's parents. `subjectId` is nil when I am the class teacher.
    func openThread(studentId: String, subjectId: String?) async throws -> StaffThread

    func staff(query: String) async throws -> [StaffMember]

    func feesSummary() async throws -> FeesSummary
    func dues(query: String, offset: Int) async throws -> DuesPage

    // The layout, and the modules behind the Library and People & access tabs.
    func homeLayout() async throws -> HomeLayout
    func librarySummary() async throws -> LibrarySummary
    func books(query: String, offset: Int) async throws -> StaffPage<LibraryBook>
    func overdueLoans(offset: Int) async throws -> StaffPage<LibraryLoan>
    func accessOptions() async throws -> AccessOptions
    func setPermissions(staffId: String, permissions: [String]) async throws -> StaffMember
    func teachers() async throws -> [TeacherChoice]
    func createSubject(name: String) async throws -> StaffSubject
    func setClassSubjects(classId: String, subjectIds: [String]) async throws
    func setClassTeacher(classId: String, staffId: String?) async throws
    func setSubjectTeacher(classId: String, subjectId: String, staffId: String?) async throws
    func classTimetable(classId: String) async throws -> ClassTimetable
    func addLesson(classId: String, weekday: Int, periodId: String, subjectId: String, staffId: String) async throws
    func changeLesson(id: String, subjectId: String, staffId: String) async throws
    func deleteLesson(id: String) async throws
    func setSchoolLogo(jpeg: Data?) async throws
    func setDesignation(staffId: String, designation: String) async throws -> StaffMember
    func addStaff(name: String, email: String, designation: String, permissions: [String], sendLogin: Bool) async throws -> StaffMember
    func sendLogin(staffId: String) async throws

    func signOut()
}

/// What this person may see and do. Admin bypasses everything; a teacher is limited to assigned classes.
struct StaffAccess {
    let me: StaffMe

    #if DEBUG
    static var isPreviewing: Bool { preview != nil }
    /// How many classes the previewed class teacher has: `classTeacher` is one, `classTeacher2` is two.
    static var previewClassCount: Int { preview == "classTeacher2" ? 2 : (preview == "classTeacher" ? 1 : 0) }
    /// Development only: launch the app with `-KrevoPreview subject` (a teacher with no extra permissions) or
    /// `-KrevoPreview classTeacher` to see exactly what that person would see, using any account. Not in release builds.
    private static let preview: String? = {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-KrevoPreview"), i + 1 < args.count else { return nil }
        return args[i + 1]
    }()
    #endif

    /// Holds all five permissions: what used to be called the admin.
    var isAdmin: Bool {
        #if DEBUG
        if Self.preview != nil { return false }
        #endif
        return Self.all.allSatisfy { has($0) }
    }
    static let all = ["academic.manage", "fees.manage", "library.manage", "announcements.manage", "people.manage"]

    /// One permission. Nothing is implied by "admin": a person has exactly what they were given.
    func has(_ permission: String) -> Bool {
        #if DEBUG
        if Self.preview != nil { return false }
        #endif
        return me.permissions.contains(permission)
    }
    var canSeeAcademic: Bool { has("academic.manage") }
    var canSeeFees: Bool { has("fees.manage") }
    var canSeeLibrary: Bool { has("library.manage") }
    /// May write to the whole school and to any class. Teachers can always write to their own classes.
    var canAnnounce: Bool { has("announcements.manage") }
    var canManagePeople: Bool { has("people.manage") }
    var canSeeStaff: Bool { canManagePeople }
    /// Class teacher of at least one class (or admin): may mark attendance and decide leave.
    var canMarkAttendance: Bool {
        #if DEBUG
        if let p = Self.preview { return p == "classTeacher" }
        #endif
        return isAdmin || me.assignments.contains { $0.role == "class_teacher" }
    }

    /// The tabs, menu and Home blocks when the server's layout is not available (preview builds, or no connection yet).
    /// Mirrors `GET /home/layout`.
    var fallbackLayout: HomeLayout {
        var tabs = ["home", "messages"], blocks = ["my_day", "my_classes", "notices"], menu: [String] = []
        for (on, name) in [(canSeeAcademic, "academic"), (canSeeFees, "fees"), (canSeeLibrary, "library")] where on {
            tabs.append(name); blocks.append(name)
        }
        if canManagePeople { menu.append("people"); blocks.append("people") }
        return HomeLayout(tabs: tabs, menu: menu, blocks: blocks, hasAssignments: !me.assignments.isEmpty)
    }
    var roleTitle: String {
        if let d = me.designation, !d.isEmpty { return d }
        return isAdmin ? "Full access" : "Teacher"
    }

    func classIdsToMark(all: [String]) -> [String] {
        if isAdmin { return all }
        return me.assignments.filter { $0.role == "class_teacher" }.map(\.classId)
    }
}
