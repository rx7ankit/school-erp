import Foundation

/// Static demo content: Rewa Public School, siblings Aarav (8-B) and Diya (7-A, promoted from 6-A three days ago).
/// Shapes mirror apps/web/src/lib/mock.ts.
enum MockData {
    static let aarav = Child(
        id: "ch1", name: "Aarav Tiwari", classLabel: "8-B", rollNo: 12, scholarNo: "RPS2001",
        dob: "2012-03-14", classTeacher: "Rajiv Mishra",
        guardians: [
            Guardian(name: "Rakesh Tiwari", relation: "Father", phone: "90000 10001"),
            Guardian(name: "Sunita Tiwari", relation: "Mother", phone: "90000 10002")
        ],
        status: .active, leftOn: nil)

    static let diya = Child(
        id: "ch2", name: "Diya Tiwari", classLabel: "7-A", rollNo: 7, scholarNo: "RPS2004",
        dob: "2014-08-22", classTeacher: "Sunita Dwivedi",
        guardians: [
            Guardian(name: "Rakesh Tiwari", relation: "Father", phone: "90000 10001"),
            Guardian(name: "Sunita Tiwari", relation: "Mother", phone: "90000 10002")
        ],
        status: .active, leftOn: nil)

    static let ishita = Child(
        id: "ch3", name: "Ishita Mishra", classLabel: "9-A", rollNo: 4, scholarNo: "RPS1988",
        dob: "2011-12-02", classTeacher: "Dinesh Gupta",
        guardians: [Guardian(name: "Manoj Mishra", relation: "Father", phone: "90000 10011")],
        status: .left, leftOn: "2026-10-15")

    // MARK: Accounts

    struct Account {
        let user: User
        let password: String
        let children: [Child]
    }

    static let accounts: [String: Account] = [
        "parent@demo.in": Account(
            user: User(id: "u1", name: "Rakesh Tiwari", kind: .parent, mustChangePassword: false),
            password: "Scool@123", children: [aarav, diya]),
        "staff@demo.in": Account(
            user: User(id: "u2", name: "Rajiv Mishra", kind: .staff, mustChangePassword: false),
            password: "Scool@123", children: []),
        "new@demo.in": Account(
            user: User(id: "u3", name: "Rakesh Tiwari", kind: .parent, mustChangePassword: true),
            password: "Temp@1234", children: [aarav, diya]),
        // Extra demo account to show the "left school" state.
        "left@demo.in": Account(
            user: User(id: "u4", name: "Manoj Mishra", kind: .parent, mustChangePassword: false),
            password: "Scool@123", children: [ishita])
    ]

    // MARK: Today

    static func today(childId: String) -> TodayAttendance {
        switch childId {
        case "ch1": return TodayAttendance(status: .present, markedAt: "2026-11-01T03:42:00Z")
        case "ch2": return TodayAttendance(status: .halfDaySecond, markedAt: "2026-11-01T04:05:00Z")
        default: return TodayAttendance(status: .notMarked, markedAt: nil)
        }
    }

    // MARK: Attendance (generated deterministically)

    private static let diwaliBreak = "2026-11-08"..."2026-11-12"

    static func attendanceMonth(childId: String, month: String) -> [AttendanceDay] {
        let seed = childId == "ch1" ? 1 : (childId == "ch2" ? 4 : 2)
        let today = IST.todayOn()
        var out: [AttendanceDay] = []
        for d in 1...IST.daysInMonth(month) {
            let on = IST.dayOn(month, d)
            if on > today { break }
            if childId == "ch3" && on > "2026-10-15" { break }
            let status: AttendanceStatus
            if IST.weekdayIndex(on) == 0 || diwaliBreak.contains(on) {
                status = .holiday
            } else {
                switch (d * 7 + seed) % 23 {
                case 3: status = .absent
                case 9: status = .halfDayFirst
                case 15: status = .halfDaySecond
                case 19: status = .leave
                default: status = .present
                }
            }
            out.append(AttendanceDay(on: on, status: status))
        }
        return out
    }

    // MARK: Exams

    private static func grade(_ marks: Int, _ max: Int) -> String {
        Grading.letter(percentage: Double(marks) / Double(max) * 100)
    }

    private static func exam(_ id: String, _ name: String, _ publishedAt: String, _ marks: [Int], _ remark: String) -> ExamDetail {
        let names = ["Mathematics", "English", "Hindi", "Science", "Social Science"]
        var subjects: [SubjectMark] = []
        for (i, m) in marks.enumerated() {
            subjects.append(SubjectMark(subject: names[i], marks: m, max: 50, grade: grade(m, 50)))
        }
        return ExamDetail(id: id, name: name, publishedAt: publishedAt, subjects: subjects, remark: remark)
    }

    static let examDetails: [String: [ExamDetail]] = [
        "ch1": [
            exam("e-ch1-ut2", "Unit Test 2", "2026-10-27T06:30:00Z", [42, 38, 44, 40, 36],
                 "Aarav is doing well. Keep practising Chapter 6 in Mathematics."),
            exam("e-ch1-an25", "Annual Exam", "2026-03-28T06:00:00Z", [41, 37, 43, 39, 35],
                 "A steady year. Aarav has improved in English and Science."),
            exam("e-ch1-hy25", "Half-yearly Exam", "2025-12-18T06:00:00Z", [38, 34, 40, 36, 32],
                 "Good effort. Needs more practice in Social Science."),
            exam("e-ch1-ut1", "Unit Test 1", "2026-08-20T07:00:00Z", [39, 35, 41, 37, 33],
                 "Good start to the year. Needs more attention to Social Science.")
        ],
        "ch2": [
            exam("e-ch2-ut2", "Unit Test 2", "2026-10-27T06:45:00Z", [45, 41, 43, 44, 40],
                 "Diya is attentive and curious. Excellent work in Mathematics."),
            exam("e-ch2-ut1", "Unit Test 1", "2026-08-20T07:15:00Z", [43, 40, 42, 41, 38],
                 "Very good performance. Keep it up.")
        ],
        "ch3": [
            exam("e-ch3-ut1", "Unit Test 1", "2026-08-20T07:30:00Z", [30, 34, 36, 31, 29],
                 "Steady effort through the term.")
        ]
    ]

    static func exams(childId: String) -> [ExamSummary] {
        (examDetails[childId] ?? []).map {
            ExamSummary(id: $0.id, name: $0.name, publishedAt: $0.publishedAt, percentage: $0.percentage)
        }
    }

    static func examDetail(id: String) -> ExamDetail? {
        for list in examDetails.values {
            if let found = list.first(where: { $0.id == id }) { return found }
        }
        return nil
    }

    // MARK: Updates feed (school and class broadcasts)

    private static let principal = "Dr. R. K. Sharma (Principal)"

    /// A school broadcast plus teacher broadcasts for the child's class. The first two are unread.
    static func updates(childId: String) -> [Update] {
        func make(_ id: String, _ kind: UpdateKind, _ tag: String, _ sender: String, _ text: String,
                  _ file: String? = nil, at: String, read: Bool = true) -> Update {
            Update(id: "up-\(childId)-\(id)", kind: kind, tag: tag, sender: sender, text: text,
                   attachment: file, at: at, isRead: read)
        }
        switch childId {
        case "ch1":
            return [
                make("school", .school, Update.schoolTag, principal,
                     "School will remain closed from 8 to 12 November for Diwali. Classes resume on 13 November.",
                     at: "2026-10-31T10:30:00Z", read: false),
                make("maths", .classBroadcast, "Mathematics", "Rajiv Mishra",
                     "Homework for Friday uploaded. Unit test syllabus is Chapters 5 to 7.",
                     "Math-Practice-Sheet.pdf", at: "2026-10-31T09:20:00Z", read: false),
                make("science", .classBroadcast, "Science", "Farhan Khan",
                     "Please bring chart paper and colours for Monday's project work.", at: "2026-10-30T10:10:00Z"),
                make("general", .classBroadcast, Update.generalTag, "Rajiv Mishra",
                     "PTM slots for Class 8-B open on Saturday. Please confirm your slot with me.", at: "2026-10-28T05:15:00Z")
            ]
        case "ch2":
            return [
                make("school", .school, Update.schoolTag, principal,
                     "School will remain closed from 8 to 12 November for Diwali. Classes resume on 13 November.",
                     at: "2026-10-31T10:30:00Z", read: false),
                make("general", .classBroadcast, Update.generalTag, "Sunita Dwivedi",
                     "PTM slots are open for booking.", at: "2026-10-30T07:05:00Z", read: false),
                make("hindi", .classBroadcast, "Hindi", "Pooja Singh",
                     "Learn the poem 'Ek Bhi Aansoo' for recitation next week.",
                     "Hindi-Poem.pdf", at: "2026-10-29T08:00:00Z"),
                make("science", .classBroadcast, "Science", "Farhan Khan",
                     "Science project guidelines attached.", "Science-Project.pdf", at: "2026-10-28T06:30:00Z")
            ]
        default:
            return [
                make("general", .classBroadcast, Update.generalTag, "Dinesh Gupta",
                     "Class 9-A: revision notes for Social Science are on the notice board.", at: "2026-10-12T06:00:00Z")
            ]
        }
    }

    // MARK: Teacher threads (seed)

    struct ThreadSeed {
        let id: String
        let childId: String
        let teacher: String
        let subject: String
        let isClassTeacher: Bool
        let active: Bool        // false = former teacher: greyed, read-only
        let unread: Int
    }

    static let threadSeeds: [ThreadSeed] = [
        ThreadSeed(id: "th1", childId: "ch1", teacher: "Rajiv Mishra", subject: "Mathematics", isClassTeacher: true, active: true, unread: 0),
        ThreadSeed(id: "th2", childId: "ch1", teacher: "Sunita Dwivedi", subject: "English", isClassTeacher: false, active: true, unread: 1),
        ThreadSeed(id: "th3", childId: "ch1", teacher: "Farhan Khan", subject: "Science", isClassTeacher: false, active: true, unread: 1),
        ThreadSeed(id: "th7", childId: "ch1", teacher: "Anita Joshi", subject: "English", isClassTeacher: false, active: false, unread: 0),
        ThreadSeed(id: "th4", childId: "ch2", teacher: "Sunita Dwivedi", subject: "English", isClassTeacher: true, active: true, unread: 1),
        ThreadSeed(id: "th5", childId: "ch2", teacher: "Pooja Singh", subject: "Hindi", isClassTeacher: false, active: true, unread: 0),
        ThreadSeed(id: "th8", childId: "ch2", teacher: "Farhan Khan", subject: "Science", isClassTeacher: false, active: true, unread: 0),
        ThreadSeed(id: "th9", childId: "ch2", teacher: "Kavita Verma", subject: "Social Science", isClassTeacher: false, active: false, unread: 0),
        ThreadSeed(id: "th6", childId: "ch3", teacher: "Dinesh Gupta", subject: "Social Science", isClassTeacher: true, active: true, unread: 0)
    ]

    static let seedMessages: [String: [ThreadMessage]] = [
        "th1": [
            ThreadMessage(id: "m1", mine: false, text: "Good morning. Aarav has missed two tests. Could we meet this week?", at: "2026-10-29T12:30:00Z"),
            ThreadMessage(id: "m2", mine: true, text: "Thank you, sir. We will meet on Saturday.", at: "2026-10-29T12:45:00Z")
        ],
        "th2": [
            ThreadMessage(id: "m3", mine: false, text: "Aarav's reading has improved a lot this month.", at: "2026-10-26T08:10:00Z")
        ],
        "th3": [
            ThreadMessage(id: "m4", mine: true, text: "Sir, which chapters are in the science project?", at: "2026-10-30T11:00:00Z"),
            ThreadMessage(id: "m5", mine: false, text: "Chapters 9 and 10. Guidelines are in the class feed.", at: "2026-10-30T11:20:00Z")
        ],
        "th7": [
            ThreadMessage(id: "m8", mine: false, text: "Please send Aarav's reading log by Friday.", at: "2026-08-12T07:00:00Z"),
            ThreadMessage(id: "m9", mine: true, text: "Yes ma'am, he will bring it tomorrow.", at: "2026-08-12T09:30:00Z")
        ],
        "th4": [
            ThreadMessage(id: "m6", mine: false, text: "Diya did very well in the recitation today.", at: "2026-10-30T07:30:00Z")
        ],
        "th5": [],
        "th8": [],
        "th9": [
            ThreadMessage(id: "m10", mine: false, text: "Diya's map work was neat and complete.", at: "2026-09-05T08:00:00Z")
        ],
        "th6": [
            ThreadMessage(id: "m7", mine: false, text: "We wish Ishita all the best for her new school.", at: "2026-10-15T09:00:00Z")
        ]
    ]

    // MARK: Fees (paise)

    static func invoices(childId: String) -> [Invoice] {
        let by = "Anita Shukla (Accounts)"
        switch childId {
        case "ch1":
            return [
                // Concession and late fee; one instalment paid.
                Invoice(id: "inv1", no: "INV-3001", period: "Term 2", dueOn: "2026-11-10",
                        lines: [InvoiceLine(title: "Tuition", amountPaise: 1_500_000),
                                InvoiceLine(title: "Transport", amountPaise: 300_000),
                                InvoiceLine(title: "Activity", amountPaise: 200_000),
                                InvoiceLine(title: "Sibling concession", amountPaise: -100_000, kind: .discount),
                                InvoiceLine(title: "Late fee", amountPaise: 50_000, kind: .lateFee)],
                        payments: [Payment(id: "p1", receiptNo: "RCP-1042", mode: "UPI", reference: "UPI 4120987654", receivedBy: by, amountPaise: 1_000_000, at: "2026-10-12T05:20:00Z")]),
                // Paid in two instalments.
                Invoice(id: "inv2", no: "INV-2901", period: "Term 1", dueOn: "2026-07-10",
                        lines: [InvoiceLine(title: "Tuition", amountPaise: 1_500_000),
                                InvoiceLine(title: "Transport", amountPaise: 300_000),
                                InvoiceLine(title: "Activity", amountPaise: 200_000)],
                        payments: [Payment(id: "p2", receiptNo: "RCP-0871", mode: "Cash", reference: "-", receivedBy: by, amountPaise: 1_200_000, at: "2026-07-05T06:10:00Z"),
                                   Payment(id: "p2b", receiptNo: "RCP-0912", mode: "UPI", reference: "UPI 5530011200", receivedBy: by, amountPaise: 800_000, at: "2026-07-20T05:45:00Z")])
            ]
        case "ch2":
            return [
                // Unpaid, with previous dues carried over.
                Invoice(id: "inv3", no: "INV-3002", period: "Term 2", dueOn: "2026-11-10",
                        lines: [InvoiceLine(title: "Tuition", amountPaise: 1_400_000),
                                InvoiceLine(title: "Transport", amountPaise: 300_000),
                                InvoiceLine(title: "Activity", amountPaise: 150_000),
                                InvoiceLine(title: "Previous dues", amountPaise: 100_000, kind: .previousDues)],
                        payments: []),
                // A cheque payment was cancelled by the school and paid again by UPI.
                Invoice(id: "inv4", no: "INV-2902", period: "Term 1", dueOn: "2026-07-10",
                        lines: [InvoiceLine(title: "Tuition", amountPaise: 1_400_000),
                                InvoiceLine(title: "Transport", amountPaise: 300_000),
                                InvoiceLine(title: "Activity", amountPaise: 150_000)],
                        payments: [Payment(id: "p3", receiptNo: "RCP-0872", mode: "Cheque", reference: "Cheque 004512", receivedBy: by, amountPaise: 1_850_000, at: "2026-07-06T04:40:00Z", status: .cancelled),
                                   Payment(id: "p3b", receiptNo: "RCP-0880", mode: "UPI", reference: "UPI 6620099001", receivedBy: by, amountPaise: 1_850_000, at: "2026-07-12T06:00:00Z")])
            ]
        default:
            return [
                Invoice(id: "inv5", no: "INV-2950", period: "Term 1", dueOn: "2026-07-10",
                        lines: [InvoiceLine(title: "Tuition", amountPaise: 1_900_000)],
                        payments: [Payment(id: "p4", receiptNo: "RCP-0900", mode: "UPI", reference: "UPI 3987001122", receivedBy: by, amountPaise: 1_900_000, at: "2026-07-08T05:00:00Z")])
            ]
        }
    }

    // MARK: Notices & calendar

    static let notices: [Notice] = [
        Notice(id: "n1", title: "Diwali holidays announced",
               body: "School will remain closed from 8 to 12 November. Classes resume on 13 November.",
               publishedAt: "2026-10-30T05:00:00Z"),
        Notice(id: "n2", title: "Half-yearly exam timetable",
               body: "The timetable has been shared with class teachers. Parents will receive it in the app.",
               publishedAt: "2026-10-28T08:30:00Z"),
        Notice(id: "n3", title: "Parent-teacher meeting",
               body: "PTM is on Saturday from 10:00 am to 1:00 pm. Please confirm your slot with the class teacher.",
               publishedAt: "2026-10-26T04:20:00Z")
    ]

    static let calendar: [CalendarEvent] = [
        CalendarEvent(id: "h1", title: "Diwali Break", fromOn: "2026-11-08", toOn: "2026-11-12", kind: .holiday),
        CalendarEvent(id: "h2", title: "Half-yearly Exams", fromOn: "2026-11-23", toOn: "2026-12-04", kind: .exam),
        CalendarEvent(id: "h3", title: "Annual Sports Day", fromOn: "2026-12-12", toOn: "2026-12-12", kind: .event),
        CalendarEvent(id: "h4", title: "Winter Break", fromOn: "2026-12-25", toOn: "2027-01-03", kind: .holiday)
    ]

    // MARK: Feedback

    /// Two requests per active child: an open one for the class and one already answered.
    /// Closing dates are IST calendar dates relative to today. A child who left gets none.
    static func feedbackRequests(childId: String) -> [FeedbackRequest] {
        let today = IST.todayOn()
        let targets: [FeedbackTarget]
        switch childId {
        case "ch1":
            targets = [
                FeedbackTarget(id: "t-rm", teacher: "Rajiv Mishra", subject: "Mathematics", isClassTeacher: true),
                FeedbackTarget(id: "t-sd", teacher: "Sunita Dwivedi", subject: "English", isClassTeacher: false),
                FeedbackTarget(id: "t-fk", teacher: "Farhan Khan", subject: "Science", isClassTeacher: false)
            ]
        case "ch2":
            targets = [
                FeedbackTarget(id: "t-sd", teacher: "Sunita Dwivedi", subject: "English", isClassTeacher: true),
                FeedbackTarget(id: "t-ps", teacher: "Pooja Singh", subject: "Hindi", isClassTeacher: false),
                FeedbackTarget(id: "t-fk", teacher: "Farhan Khan", subject: "Science", isClassTeacher: false)
            ]
        default:
            return []
        }
        let answered = [
            FeedbackRating(targetId: targets[0].id, rating: 5, comment: "Always approachable."),
            FeedbackRating(targetId: targets[1].id, rating: 4, comment: nil)
        ]
        return [
            FeedbackRequest(id: "fb-\(childId)-t2", title: "Term 2 teacher feedback",
                            closesOn: IST.addDays(today, 21), targets: targets, ratings: []),
            FeedbackRequest(id: "fb-\(childId)-t1", title: "Term 1 teacher feedback",
                            closesOn: IST.addDays(today, 7), targets: targets, ratings: answered)
        ]
    }

    // MARK: Notifications

    /// One of each type per child, newest first. Times are relative to now and shown in IST.
    /// Older items are already read. A child who left only gets the fee and notice items.
    static func notifications(childId: String) -> [AppNotification] {
        let child = [aarav, diya, ishita].first(where: { $0.id == childId })
        guard let child else { return [] }
        let name = child.firstName
        let due = invoices(childId: childId).first(where: { $0.duePaise > 0 })
        func item(_ key: String, _ kind: NotificationKind, minutesAgo: Int, read: Bool, detail: String = "",
                  sender: String = "", subject: String = "") -> AppNotification {
            AppNotification(id: "nt-\(childId)-\(key)", kind: kind, childId: childId, childName: name,
                            at: IST.isoAgo(minutes: minutesAgo), isRead: read, detail: detail,
                            amountPaise: due?.duePaise ?? 0, dueOn: due?.dueOn ?? "", sender: sender, subject: subject)
        }
        func preview(_ text: String) -> String { String(text.prefix(90)) }
        var list: [AppNotification] = []
        if !child.hasLeft {
            let todayKind: NotificationKind = childId == "ch2" ? .attendanceSecondHalf : .attendancePresent
            list.append(item("att-today", todayKind, minutesAgo: 25, read: false))
            list.append(item("att-absent", .attendanceAbsent, minutesAgo: 60 * 30, read: true))
            list.append(item("att-first", .attendanceFirstHalf, minutesAgo: 60 * 24 * 4, read: true))
            let feed = updates(childId: childId)
            if let school = feed.first(where: { $0.kind == .school }) {
                list.append(item("bc-school", .broadcast, minutesAgo: 60 * 30, read: false,
                                 detail: preview(school.text), sender: school.sender, subject: Update.schoolTag))
            }
            if let teacher = feed.first(where: { $0.kind == .classBroadcast && $0.tag != Update.generalTag }) {
                list.append(item("bc-class", .broadcast, minutesAgo: 60 * 24 + 40, read: false,
                                 detail: preview(teacher.text), sender: teacher.sender, subject: teacher.tag))
            }
            if let seed = threadSeeds.first(where: { $0.childId == childId && $0.active && $0.unread > 0 }),
               let last = seedMessages[seed.id]?.last {
                list.append(item("msg", .message, minutesAgo: 60 * 5, read: false,
                                 detail: preview(last.text), sender: seed.teacher, subject: seed.subject))
            }
            list.append(item("feedback", .feedbackRequested, minutesAgo: 60 * 24 * 5, read: false))
            list.append(item("result", .resultPublished, minutesAgo: 60 * 24 * 5 + 120, read: true, detail: "Unit Test 2"))
            list.append(item("leave-ok", .leaveApproved, minutesAgo: 60 * 24 * 12, read: true))
            list.append(item("leave-no", .leaveRejected, minutesAgo: 60 * 24 * 26, read: true))
            list.append(item("report", .reportCard, minutesAgo: 60 * 24 * 5 + 60, read: false, detail: "Unit Test 2"))
            list.append(item("exam", .examDateSheet, minutesAgo: 60 * 24 * 2, read: false, detail: "Half-yearly Exam"))
        }
        if childId == "ch2" {
            list.append(AppNotification(
                id: "nt-ch2-promo", kind: .promotionPromoted, childId: childId, childName: name,
                at: IST.isoAgo(minutes: 60 * 24 * 3), isRead: false, classLabel: diya.classLabel, academicYear: "2026-27"))
        }
        if due != nil {
            list.append(item("fee", .feeReminder, minutesAgo: 60 * 8, read: false))
        }
        list.append(item("notice", .notice, minutesAgo: 60 * 26, read: true, detail: "Diwali holidays announced"))
        return list.sorted { $0.at > $1.at }
    }

    // MARK: Exam date sheet

    /// Half-yearly date sheet starting two weeks from today (IST), one paper every second day, never on Sunday.
    static func examSchedules(childId: String) -> [ExamSchedule] {
        let subjects: [String]
        let classLabel: String
        switch childId {
        case "ch1":
            subjects = ["Hindi", "English", "Mathematics", "Science", "Social Science"]
            classLabel = aarav.classLabel
        case "ch2":
            subjects = ["English", "Hindi", "Mathematics", "Science", "Computer"]
            classLabel = diya.classLabel
        default:
            return []
        }
        var day = IST.addDays(IST.todayOn(), 14)
        var papers: [ExamPaper] = []
        for (index, subject) in subjects.enumerated() {
            while IST.weekdayIndex(day) == 0 { day = IST.addDays(day, 1) }
            // 04:00 UTC is 9:30 am IST.
            papers.append(ExamPaper(id: "pp-\(childId)-\(index)", subject: subject, startAt: day + "T04:00:00Z"))
            day = IST.addDays(day, 2)
        }
        let first = String((papers.first?.startAt ?? "").prefix(10))
        let last = String((papers.last?.startAt ?? "").prefix(10))
        return [ExamSchedule(id: "es-\(childId)-hy", name: "Half-yearly Exam", classLabel: classLabel,
                             fromOn: first, toOn: last, papers: papers)]
    }

    // MARK: Leave

    static func isLeft(childId: String) -> Bool {
        [aarav, diya, ishita].first(where: { $0.id == childId })?.hasLeft ?? false
    }

    /// Three requests per child: pending (or cancelled for a child who left), approved, rejected with a note.
    static func leaveRequests(childId: String) -> [LeaveRequest] {
        let today = IST.todayOn()
        let left = isLeft(childId: childId)
        func day(_ offset: Int) -> String { IST.addDays(today, offset) }
        return [
            LeaveRequest(id: "lv-\(childId)-1", childId: childId,
                         fromOn: day(left ? -30 : 3), toOn: day(left ? -29 : 4), half: .none,
                         reason: "Family function out of town.",
                         status: left ? .cancelled : .pending, decisionNote: nil,
                         createdAt: IST.isoAgo(minutes: 60 * 20)),
            LeaveRequest(id: "lv-\(childId)-2", childId: childId,
                         fromOn: day(-12), toOn: day(-12), half: .first,
                         reason: "Doctor appointment in the morning.",
                         status: .approved, decisionNote: "Approved. Please share the class notes with a friend.",
                         createdAt: IST.isoAgo(minutes: 60 * 24 * 14)),
            LeaveRequest(id: "lv-\(childId)-3", childId: childId,
                         fromOn: day(-25), toOn: day(-23), half: .none,
                         reason: "Visiting grandparents.",
                         status: .rejected, decisionNote: "Unit tests are on these days. Please apply for other dates.",
                         createdAt: IST.isoAgo(minutes: 60 * 24 * 28))
        ]
    }

    // MARK: Timetable

    /// Six teaching periods and one break; subjects rotate by day. A substitute covers period 3 today.
    static func timetable(childId: String) -> Timetable {
        let subjects: [(String, String)]
        let classLabel: String
        switch childId {
        case "ch1":
            classLabel = aarav.classLabel
            subjects = [("Mathematics", "Rajiv Mishra"), ("English", "Sunita Dwivedi"), ("Hindi", "Pooja Singh"),
                        ("Science", "Farhan Khan"), ("Social Science", "Dinesh Gupta"), ("Computer", "Anita Rao")]
        case "ch2":
            classLabel = diya.classLabel
            subjects = [("English", "Sunita Dwivedi"), ("Mathematics", "Rajiv Mishra"), ("Hindi", "Pooja Singh"),
                        ("Science", "Farhan Khan"), ("Computer", "Anita Rao"), ("Social Science", "Dinesh Gupta")]
        default:
            classLabel = ishita.classLabel
            subjects = [("Mathematics", "Dinesh Gupta"), ("English", "Sunita Dwivedi"), ("Hindi", "Pooja Singh"),
                        ("Science", "Farhan Khan"), ("Social Science", "Rajiv Mishra"), ("Computer", "Anita Rao")]
        }
        let periods = [
            Period(id: 1, label: "1", start: "09:00", end: "09:40", isBreak: false),
            Period(id: 2, label: "2", start: "09:40", end: "10:20", isBreak: false),
            Period(id: 3, label: "3", start: "10:20", end: "11:00", isBreak: false),
            Period(id: 4, label: "Break", start: "11:00", end: "11:20", isBreak: true),
            Period(id: 5, label: "4", start: "11:20", end: "12:00", isBreak: false),
            Period(id: 6, label: "5", start: "12:00", end: "12:40", isBreak: false),
            Period(id: 7, label: "6", start: "12:40", end: "13:20", isBreak: false)
        ]
        var slots: [TimetableSlot] = []
        let teaching = periods.filter { !$0.isBreak }
        for weekday in 1...6 {
            for (index, period) in teaching.enumerated() {
                let pick = subjects[(index + weekday - 1) % subjects.count]
                slots.append(TimetableSlot(periodId: period.id, weekday: weekday, subject: pick.0, teacher: pick.1))
            }
        }
        var substitutions: [Substitution] = []
        let today = IST.todayOn()
        if (1...6).contains(IST.weekdayIndex(today)) {
            substitutions.append(Substitution(on: today, periodId: 3, teacher: "Meena Pandey"))
        }
        return Timetable(classLabel: classLabel, periods: periods, slots: slots, substitutions: substitutions)
    }
}
