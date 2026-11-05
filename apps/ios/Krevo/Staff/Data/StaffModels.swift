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
    var label: String { section.isEmpty ? grade : "\(grade)-\(section)" }
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
}

struct BroadcastDraft: Encodable {
    let title: String
    let body: String
    let scope: String          // "school" or "class"
    let audience: String       // "all" for school scope
    let classId: String?
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
