import Foundation

/// Offline demo data for the staff app (sign in as staff@demo.in or teacher@demo.in). Same shapes as the live API,
/// and edits (attendance, leave decisions, announcements) stick for the run, so every screen can be tried.
final class DemoStaffRepository: StaffRepository, @unchecked Sendable {
    enum Role { case admin, teacher }

    private let role: Role
    private let lock = NSLock()
    private var sheets: [String: AttendanceSheet] = [:]
    private var leaveList: [StaffLeave]
    private var posts: [Broadcast]

    private let classList: [StaffClass] = [
        StaffClass(id: "c6a", grade: "6", section: "A", capacity: 40, students: 8, classTeacherId: "t1"),
        StaffClass(id: "c7a", grade: "7", section: "A", capacity: 40, students: 8, classTeacherId: "t2"),
        StaffClass(id: "c8a", grade: "8", section: "A", capacity: 40, students: 8, classTeacherId: "t3"),
        StaffClass(id: "c8b", grade: "8", section: "B", capacity: 40, students: 8, classTeacherId: "t4"),
    ]
    private let names: [[String]] = [
        ["Aarav Tiwari", "Ananya Agrawal", "Vivaan Tripathi", "Diya Mishra", "Aditya Patel", "Ishita Rajak", "Kabir Shukla", "Meera Pandey"],
        ["Rohan Verma", "Saanvi Gupta", "Arjun Yadav", "Kavya Soni", "Yash Dwivedi", "Riya Khan", "Dev Jain", "Pari Singh"],
        ["Harsh Pathak", "Navya Kushwaha", "Aryan Rajput", "Tanvi Chaturvedi", "Krish Mishra", "Myra Tiwari", "Lakshya Patel", "Siya Gupta"],
        ["Pranav Shukla", "Aadhya Verma", "Rudra Yadav", "Anika Soni", "Atharv Pandey", "Kiara Jain", "Divyansh Khan", "Prisha Singh"],
    ]

    init(role: Role) {
        self.role = role
        leaveList = [
            Self.leave("l1", "Aarav Tiwari", "SCH1001", "6-A", "Rakesh Tiwari", IST.addDays(IST.todayOn(), 1), IST.addDays(IST.todayOn(), 2), "Fever and doctor's advice to rest for two days.", "pending"),
            Self.leave("l2", "Diya Mishra", "SCH1004", "6-A", "Manoj Mishra", IST.addDays(IST.todayOn(), 3), IST.addDays(IST.todayOn(), 3), "Family wedding in Satna.", "pending"),
            Self.leave("l3", "Kabir Shukla", "SCH1007", "6-A", "Pramod Shukla", IST.addDays(IST.todayOn(), -4), IST.addDays(IST.todayOn(), -3), "Viral infection.", "approved"),
            Self.leave("l4", "Ishita Rajak", "SCH1006", "6-A", "Dinesh Rajak", IST.addDays(IST.todayOn(), -9), IST.addDays(IST.todayOn(), -9), "Dental appointment.", "rejected"),
        ]
        posts = [
            Broadcast(id: "b1", title: "Parent-Teacher Meeting on 21 November", body: "The meeting for all classes is on Saturday, 21 November, 9:00 AM to 12:30 PM. Please collect the Half Yearly report card.", createdAt: IST.isoAgo(minutes: 60 * 20), scope: "school", classLabel: nil, senderName: "Principal", readCount: 212, recipientCount: 308),
            Broadcast(id: "b2", title: "Diwali vacation", body: "School stays closed from 7 to 11 November. Classes resume on 12 November.", createdAt: IST.isoAgo(minutes: 60 * 50), scope: "school", classLabel: nil, senderName: "Principal", readCount: 260, recipientCount: 308),
            Broadcast(id: "b3", title: "Maths worksheet 4", body: "Please complete worksheet 4 before Monday. We will discuss it in class.", createdAt: IST.isoAgo(minutes: 60 * 28), scope: "class", classLabel: "6-A", senderName: "Sunita Tiwari", readCount: 6, recipientCount: 8),
        ]
    }

    private static func leave(_ id: String, _ student: String, _ scholar: String, _ cls: String, _ guardian: String,
                              _ from: String, _ to: String, _ reason: String, _ status: String) -> StaffLeave {
        StaffLeave(id: id, classLabel: cls, createdAt: IST.isoAgo(minutes: 300), decidedAt: status == "pending" ? nil : IST.isoAgo(minutes: 60),
                   decidedByName: status == "pending" ? nil : "Sunita Tiwari", decisionNote: nil, fromOn: from, toOn: to, guardianName: guardian,
                   half: "full", reason: reason, scholarNo: scholar, status: status, studentName: student)
    }

    // MARK: Identity and dashboard

    func me() async throws -> StaffMe {
        switch role {
        case .admin:
            return StaffMe(id: "u2", name: "Rajiv Mishra", email: "staff@demo.in", kind: "staff", isAdmin: true, designation: "Principal",
                           permissions: [], assignments: [], school: StaffSchool(id: "s1", name: "Rewa Public School", status: "active"))
        case .teacher:
            return StaffMe(id: "u5", name: "Sunita Tiwari", email: "teacher@demo.in", kind: "staff", isAdmin: false, designation: "Senior Teacher",
                           permissions: [], assignments: [StaffAssignment(classId: "c6a", role: "class_teacher", subjectId: nil)],
                           school: StaffSchool(id: "s1", name: "Rewa Public School", status: "active"))
        }
    }

    func dashboard() async throws -> StaffDashboard {
        let admin = role == .admin
        return StaffDashboard(
            attendance: .init(classesMarkedToday: admin ? 3 : 1, classesTotal: admin ? 4 : 1, monthPercentage: 93.4, todayPercentage: 94.2),
            classes: admin ? 4 : 1,
            fees: admin ? .init(collectedThisMonthPaise: 6_255_000, duesPaise: 94_885_000, duesStudents: 290, overduePaise: 58_082_500) : nil,
            results: .init(averagePercentage: 68.5, exam: "Half Yearly Examination"),
            staff: admin ? .init(absentToday: 0, activeStaff: 18, notMarkedToday: 2, presentToday: 16) : nil,
            students: admin ? 32 : 8, year: "2026-27")
    }

    func classes() async throws -> [StaffClass] { classList }

    // MARK: Attendance

    func attendanceSheet(classId: String, day: String) async throws -> AttendanceSheet {
        lock.lock(); defer { lock.unlock() }
        return sheet(classId, day)
    }

    func saveAttendance(classId: String, day: String, records: [AttendanceRecord]) async throws -> AttendanceSheet {
        lock.lock(); defer { lock.unlock() }
        var current = sheet(classId, day)
        for record in records {
            guard let i = current.students.firstIndex(where: { $0.studentId == record.studentId }) else { continue }
            current.students[i].firstHalf = record.firstHalf
            current.students[i].secondHalf = record.secondHalf
            current.students[i].late = record.late
        }
        let saved = AttendanceSheet(canMark: true, classId: classId, classLabel: current.classLabel, dayOn: day, holiday: nil, marked: true,
                                    markedAt: IST.nowISO(), students: current.students.map { s in var s = s; return SheetStudent(enrollmentId: s.enrollmentId, firstHalf: s.firstHalf, secondHalf: s.secondHalf, late: s.late, name: s.name, note: s.note, rollNo: s.rollNo, saved: true, scholarNo: s.scholarNo, studentId: s.studentId) })
        sheets[classId + "|" + day] = saved
        return saved
    }

    private func sheet(_ classId: String, _ day: String) -> AttendanceSheet {
        if let found = sheets[classId + "|" + day] { return found }
        let index = classList.firstIndex { $0.id == classId } ?? 0
        let label = classList[index].label
        let sunday = IST.weekdayIndex(day) == 0
        let students = names[index].enumerated().map { i, name in
            SheetStudent(enrollmentId: "e\(classId)\(i)", firstHalf: .present, secondHalf: .present, late: false, name: name, note: nil,
                         rollNo: i + 1, saved: false, scholarNo: "SCH\(1001 + index * 8 + i)", studentId: "s\(classId)\(i)")
        }
        return AttendanceSheet(canMark: !sunday, classId: classId, classLabel: label, dayOn: day, holiday: sunday ? "Sunday" : nil, marked: false, markedAt: nil, students: students)
    }

    // MARK: Students

    func students(query: String, classId: String?, offset: Int) async throws -> StaffPage<StudentItem> {
        var items: [StudentItem] = []
        for (ci, cls) in classList.enumerated() {
            if role == .teacher && cls.id != "c6a" { continue }
            if let classId, classId != cls.id { continue }
            for (i, name) in names[ci].enumerated() {
                let surname = name.split(separator: " ").last.map(String.init) ?? ""
                items.append(StudentItem(id: "s\(cls.id)\(i)", name: name, classLabel: cls.label, rollNo: i + 1, scholarNo: "SCH\(1001 + ci * 8 + i)",
                                         guardianName: "Rakesh \(surname)", guardianPhone: "98260\(10000 + ci * 800 + i * 37)", status: "active", gender: i % 2 == 0 ? "male" : "female", dob: "20\(10 + ci)-0\(1 + i % 9)-1\(i % 9)"))
            }
        }
        let q = query.lowercased()
        if !q.isEmpty { items = items.filter { $0.name.lowercased().contains(q) || $0.scholarNo.lowercased().contains(q) } }
        return StaffPage(items: Array(items.dropFirst(offset).prefix(40)), total: items.count)
    }

    func student(id: String) async throws -> StudentDetail {
        let all = try await students(query: "", classId: nil, offset: 0).items
        guard let s = all.first(where: { $0.id == id }) else { throw StaffError("Student not found.") }
        return StudentDetail(
            id: s.id, name: s.name, scholarNo: s.scholarNo, status: "active", gender: s.gender, dob: s.dob, bloodGroup: "B+", category: "General",
            address: "142, Rajendra Nagar, Rewa, M.P. 486001", admittedOn: "2024-06-12", medicalNotes: nil, emergencyName: s.guardianName, emergencyPhone: s.guardianPhone,
            guardians: [
                GuardianInfo(id: "g\(s.id)1", name: s.guardianName ?? "Guardian", relation: "father", phone: s.guardianPhone, email: nil, isPrimary: true, occupation: "Shopkeeper"),
                GuardianInfo(id: "g\(s.id)2", name: "Sunita " + (s.name.split(separator: " ").last.map(String.init) ?? ""), relation: "mother", phone: "99071\(20000 + s.scholarNo.count * 91)", email: nil, isPrimary: false, occupation: "Homemaker"),
            ],
            currentEnrollment: .init(classLabel: s.classLabel ?? "", rollNo: s.rollNo, academicYear: "2026-27"))
    }

    // MARK: Leave

    func leaves(status: String?) async throws -> [StaffLeave] {
        lock.lock(); defer { lock.unlock() }
        return leaveList.filter { status == nil || $0.status == status }
    }

    func decideLeave(id: String, approve: Bool, note: String) async throws -> StaffLeave {
        lock.lock(); defer { lock.unlock() }
        guard let i = leaveList.firstIndex(where: { $0.id == id }) else { throw StaffError("Leave request not found.") }
        let old = leaveList[i]
        leaveList[i] = StaffLeave(id: old.id, classLabel: old.classLabel, createdAt: old.createdAt, decidedAt: IST.nowISO(), decidedByName: "You", decisionNote: note.isEmpty ? nil : note,
                                  fromOn: old.fromOn, toOn: old.toOn, guardianName: old.guardianName, half: old.half, reason: old.reason, scholarNo: old.scholarNo,
                                  status: approve ? "approved" : "rejected", studentName: old.studentName)
        return leaveList[i]
    }

    // MARK: Timetable

    func myDay(on: String) async throws -> StaffDay {
        let weekday = IST.weekdayIndex(on)
        if weekday == 0 { return StaffDay(entries: [], on: on, weekday: 7) }
        let rows: [(Int, String, String, String, String)] = [
            (1, "08:00:00", "08:40:00", "6-A", "Mathematics"), (2, "08:40:00", "09:20:00", "7-A", "Mathematics"), (3, "09:20:00", "10:00:00", "8-A", "Mathematics"),
            (5, "11:10:00", "11:50:00", "6-A", "Mathematics"), (6, "11:50:00", "12:30:00", "8-B", "Mathematics"),
        ]
        let entries = rows.map { n, from, to, cls, subject in
            StaffDayEntry(role: "subject", slot: StaffSlot(classLabel: cls, endsAt: to, periodName: "Period \(n)", periodNumber: n, startsAt: from, subjectName: subject, staffName: "Sunita Tiwari"),
                          substituteName: nil, absentStaffName: nil)
        }
        return StaffDay(entries: entries, on: on, weekday: weekday)
    }

    // MARK: Announcements

    func broadcasts() async throws -> [Broadcast] {
        lock.lock(); defer { lock.unlock() }
        return posts
    }

    func postBroadcast(_ draft: BroadcastDraft) async throws -> Broadcast {
        lock.lock(); defer { lock.unlock() }
        let label = classList.first { $0.id == draft.classId }?.label
        let post = Broadcast(id: UUID().uuidString, title: draft.title, body: draft.body, createdAt: IST.nowISO(), scope: draft.scope, classLabel: label,
                             senderName: role == .admin ? "Rajiv Mishra" : "Sunita Tiwari", readCount: 0, recipientCount: draft.scope == "school" ? 308 : 8)
        posts.insert(post, at: 0)
        return post
    }

    // MARK: Staff and fees

    func staff(query: String) async throws -> [StaffMember] {
        let all = [
            StaffMember(id: "t1", name: "Sunita Tiwari", designation: "Senior Teacher", department: "Primary", email: "sunita.tiwari@demo.krevo.tech", phone: "9826011111", employeeCode: "EMP003", isAdmin: false, isActive: true),
            StaffMember(id: "t2", name: "Rakesh Pandey", designation: "Teacher", department: "Senior", email: "rakesh.pandey@demo.krevo.tech", phone: "9826022222", employeeCode: "EMP004", isAdmin: false, isActive: true),
            StaffMember(id: "t3", name: "Neha Shukla", designation: "Teacher", department: "Primary", email: "neha.shukla@demo.krevo.tech", phone: "9826033333", employeeCode: "EMP005", isAdmin: false, isActive: true),
            StaffMember(id: "t4", name: "Amit Mishra", designation: "Teacher", department: "Senior", email: "amit.mishra@demo.krevo.tech", phone: "9826044444", employeeCode: "EMP006", isAdmin: false, isActive: true),
            StaffMember(id: "u2", name: "Rajiv Mishra", designation: "Principal", department: "", email: "staff@demo.in", phone: nil, employeeCode: "EMP001", isAdmin: true, isActive: true),
        ]
        let q = query.lowercased()
        return q.isEmpty ? all : all.filter { $0.name.lowercased().contains(q) }
    }

    func feesSummary() async throws -> FeesSummary {
        FeesSummary(billedPaise: 247_410_000, collectedPaise: 152_525_000, collectedThisMonthPaise: 6_255_000, collectionPercentage: 61.7, duesPaise: 94_885_000,
                    duesStudents: 290, overduePaise: 58_082_500, year: "2026-27",
                    topDuesClasses: [.init(classLabel: "6-A", duesPaise: 10_687_500, students: 14), .init(classLabel: "8-A", duesPaise: 10_547_500, students: 12), .init(classLabel: "5-B", duesPaise: 9_742_500, students: 11)])
    }

    func dues(query: String, offset: Int) async throws -> DuesPage {
        let rows = try await students(query: query, classId: nil, offset: 0).items.prefix(12).enumerated().map { i, s in
            DueRow(studentId: s.id, studentName: s.name, scholarNo: s.scholarNo, classLabel: s.classLabel, duePaise: 220_000 + i * 35_000, overduePaise: i % 3 == 0 ? 220_000 : 0,
                   guardianName: s.guardianName, guardianPhone: s.guardianPhone)
        }
        return DuesPage(items: Array(rows), total: rows.count, totalDuePaise: rows.reduce(0) { $0 + $1.duePaise }, totalOverduePaise: rows.reduce(0) { $0 + $1.overduePaise })
    }

    func signOut() {}
}
