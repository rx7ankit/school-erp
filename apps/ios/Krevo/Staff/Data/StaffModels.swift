import Foundation

// Staff-side models. They mirror the JSON of the FastAPI backend (snake_case on the wire, decoded to camelCase).
// `*_on` values are plain school dates and `*_at` values are UTC instants; both stay strings and go through `IST` for display.

struct StaffToken: Decodable {
    let accessToken: String
    let expiresIn: Int
    let kind: String
    let mustChangePassword: Bool
    let refreshToken: String
}

struct StaffAssignment: Decodable, Hashable {
    let classId: String
    let role: String
    let subjectId: String?
}

struct StaffSchool: Decodable, Hashable {
    let id: String
    let name: String
    let status: String
    /// The school's logo, a short-lived link. Nil until the admin uploads one.
    let logoUrl: String?
}

struct StaffMe: Decodable, Hashable {
    let id: String
    let name: String
    let email: String
    let kind: String
    let isAdmin: Bool
    let designation: String?
    let permissions: [String]
    let assignments: [StaffAssignment]
    let school: StaffSchool?
    /// This person's own photo, a short-lived link. Nil until they set one.
    let photoUrl: String?
}

struct StaffDashboard: Decodable {
    struct Attendance: Decodable {
        let classesMarkedToday: Int
        let classesTotal: Int
        let monthPercentage: Double?
        let todayPercentage: Double?
    }
    struct Fees: Decodable {
        let collectedThisMonthPaise: Int
        let duesPaise: Int
        let duesStudents: Int
        let overduePaise: Int
    }
    struct Results: Decodable {
        let averagePercentage: Double?
        let exam: String?
    }
    struct Staff: Decodable {
        let absentToday: Int
        let activeStaff: Int
        let notMarkedToday: Int
        let presentToday: Int
    }
    let attendance: Attendance
    let classes: Int
    let fees: Fees?
    let results: Results
    let staff: Staff?
    let students: Int
    let year: String?
}

struct StaffClass: Decodable, Identifiable, Hashable {
    let id: String
    let grade: String
    let section: String
    let capacity: Int
    let students: Int?
    let classTeacherId: String?
    let subjectIds: [String]?
    var label: String { section.isEmpty ? grade : "\(grade)-\(section)" }
}

/// One class on one date, from the Classes page overview.
struct StaffClassDay: Decodable, Identifiable, Hashable {
    let classId: String
    let classLabel: String
    let marked: Bool
    let students: Int
    let percentage: Double?
    var id: String { classId }
}

struct StaffDayOverview: Decodable {
    let dayOn: String
    let holiday: String?
    let classesTotal: Int
    let classesMarked: Int
    let percentage: Double?
    let classes: [StaffClassDay]
}

/// Who teaches a class: the class teacher, and each subject's teacher.
struct StaffAssignmentRow: Decodable, Hashable {
    let classId: String
    let staffId: String
    let staffName: String
    let role: String
    let subjectId: String?
}

struct StaffSubject: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
}

struct StaffPage<T: Decodable>: Decodable {
    let items: [T]
    let total: Int
}

// MARK: Attendance

enum AttendanceValue: String, Codable, CaseIterable {
    case present, absent, leave
}

struct SheetStudent: Decodable, Identifiable, Hashable {
    let enrollmentId: String
    var firstHalf: AttendanceValue
    var secondHalf: AttendanceValue
    var late: Bool?
    let name: String
    var note: String?
    let rollNo: Int?
    let saved: Bool
    let scholarNo: String
    let studentId: String
    var id: String { studentId }
}

struct AttendanceSheet: Decodable {
    let canMark: Bool
    let classId: String
    let classLabel: String
    let dayOn: String
    let holiday: String?
    let marked: Bool
    let markedAt: String?
    var students: [SheetStudent]
}

struct AttendanceRecord: Encodable {
    let studentId: String
    let firstHalf: AttendanceValue
    let secondHalf: AttendanceValue
    let late: Bool
}

// MARK: Attendance trend

struct TrendPoint: Decodable, Identifiable, Hashable {
    let dayOn: String
    let percentage: Double?
    var id: String { dayOn }
}

struct AttendanceInsight: Decodable {
    struct ClassRow: Decodable, Identifiable, Hashable {
        let classLabel: String
        let percentage: Double?
        let students: Int
        var id: String { classLabel }
    }
    let trend: [TrendPoint]
    let overallPercentage: Double?
    let byClass: [ClassRow]
}

// MARK: Students

struct StudentItem: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let classLabel: String?
    let rollNo: Int?
    let scholarNo: String
    let guardianName: String?
    let guardianPhone: String?
    let status: String
    let gender: String?
    let dob: String?
}

struct GuardianInfo: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let relation: String
    let phone: String?
    let email: String?
    let isPrimary: Bool
    let occupation: String?
}

struct StudentDetail: Decodable {
    let id: String
    let name: String
    let scholarNo: String
    let status: String
    let gender: String?
    let dob: String?
    let bloodGroup: String?
    let category: String?
    let address: String?
    let admittedOn: String?
    let medicalNotes: String?
    let emergencyName: String?
    let emergencyPhone: String?
    let guardians: [GuardianInfo]
    let currentEnrollment: Enrollment?

    struct Enrollment: Decodable {
        let classLabel: String
        let rollNo: Int?
        let academicYear: String
    }
}

// MARK: Leave

struct StaffLeave: Decodable, Identifiable, Hashable {
    let id: String
    let classLabel: String?
    let createdAt: String
    let decidedAt: String?
    let decidedByName: String?
    let decisionNote: String?
    let fromOn: String
    let toOn: String
    let guardianName: String
    let half: String
    let reason: String
    let scholarNo: String
    let status: String
    let studentName: String
}

// MARK: Timetable

struct StaffSlot: Decodable, Hashable {
    let classLabel: String
    let endsAt: String
    let periodName: String
    let periodNumber: Int
    let startsAt: String
    let subjectName: String
    let staffName: String
}

struct StaffDayEntry: Decodable, Identifiable, Hashable {
    let role: String
    let slot: StaffSlot
    let substituteName: String?
    let absentStaffName: String?
    var id: String { "\(slot.periodNumber)|\(slot.classLabel)|\(slot.subjectName)" }
}

struct StaffDay: Decodable {
    let entries: [StaffDayEntry]
    let on: String
    let weekday: Int
}

// MARK: Chats

/// One parent conversation about a student, as the teacher sees it.
struct StaffThread: Decodable, Identifiable, Hashable {
    let id: String
    let active: Bool
    let classLabel: String?
    let lastMessageAt: String?
    let lastMessagePreview: String?
    let studentName: String
    let tag: String
    let unread: Int
}

// MARK: Announcements

struct Broadcast: Decodable, Identifiable, Hashable {
    let id: String
    let title: String
    let body: String
    let createdAt: String
    let scope: String
    let classLabel: String?
    let senderName: String
    let readCount: Int
    let recipientCount: Int
    /// Photos or files attached to the notice (up to five).
    let attachments: [BroadcastFile]?
    /// This person may edit or delete it: announcements.manage, or they sent it.
    let canEdit: Bool?
}

struct BroadcastFile: Decodable, Hashable {
    let id: String
    let filename: String
    let contentType: String
    let sizeBytes: Int
}

struct BroadcastDraft: Encodable {
    let title: String
    let body: String
    let scope: String          // "school" or "class"
    let audience: String       // "all" for school scope
    let classId: String?
    var attachmentIds: [String] = []
}

// MARK: Staff directory

struct StaffMember: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let designation: String
    let department: String
    let email: String
    let phone: String?
    let employeeCode: String
    let isAdmin: Bool
    let isActive: Bool
    let permissions: [String]?
    let inviteStatus: String?
    let lastLoginAt: String?
}

// MARK: Layout, library, access

/// What this person's app shows, decided by the server from their permissions (GET /home/layout).
struct HomeLayout: Decodable, Hashable {
    let tabs: [String]
    let menu: [String]
    let blocks: [String]
    let hasAssignments: Bool
}

struct LibrarySummary: Decodable, Hashable {
    let books: Int
    let copies: Int
    let onLoan: Int
    let overdue: Int
}

struct LibraryBook: Decodable, Identifiable, Hashable {
    let id: String
    let title: String
    let author: String
    let category: String?
    let copiesTotal: Int
    let available: Int
}

struct LibraryLoan: Decodable, Identifiable, Hashable {
    let id: String
    let title: String
    let borrowerType: String
    let studentName: String?
    let staffName: String?
    let dueOn: String
    let daysOverdue: Int
    var borrower: String { studentName ?? staffName ?? "–" }
}

struct PermissionInfo: Decodable, Identifiable, Hashable {
    let key: String
    let label: String
    let description: String
    var id: String { key }
}

struct AccessPreset: Decodable, Identifiable, Hashable {
    let key: String
    let label: String
    let description: String
    let permissions: [String]
    var id: String { key }
}

struct AccessOptions: Decodable, Hashable {
    let permissions: [PermissionInfo]
    let presets: [AccessPreset]
}

// MARK: Fees

struct FeesSummary: Decodable {
    let billedPaise: Int
    let collectedPaise: Int
    let collectedThisMonthPaise: Int
    let collectionPercentage: Double?
    let duesPaise: Int
    let duesStudents: Int
    let overduePaise: Int
    let year: String?
    let topDuesClasses: [ClassDues]

    struct ClassDues: Decodable, Identifiable, Hashable {
        let classLabel: String
        let duesPaise: Int
        let students: Int
        var id: String { classLabel }
    }
}

struct DueRow: Decodable, Identifiable, Hashable {
    let studentId: String
    let studentName: String
    let scholarNo: String
    let classLabel: String?
    let duePaise: Int
    let overduePaise: Int
    let guardianName: String?
    let guardianPhone: String?
    var id: String { studentId }
}

struct DuesPage: Decodable {
    let items: [DueRow]
    let total: Int
    let totalDuePaise: Int
    let totalOverduePaise: Int
}


// MARK: Timetable editing

struct TimetablePeriod: Decodable, Identifiable, Hashable {
    let id: String
    let number: Int
    let name: String
    let startsAt: String
    let endsAt: String
}

struct TimetableLesson: Decodable, Identifiable, Hashable {
    let id: String
    let classId: String
    let weekday: Int
    let periodId: String
    let subjectId: String
    let subjectName: String
    let staffId: String
    let staffName: String
}

struct ClassTimetable: Decodable {
    let classId: String
    let classLabel: String
    let periods: [TimetablePeriod]
    let slots: [TimetableLesson]
}

/// A person who can be given a class or a subject (the picker list for assigning teachers).
struct TeacherChoice: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let designation: String
}
