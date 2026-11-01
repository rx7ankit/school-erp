import Foundation

/// Static demo content: Rewa Public School, siblings Aarav (8-B) and Diya (6-A).
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
        id: "ch2", name: "Diya Tiwari", classLabel: "6-A", rollNo: 7, scholarNo: "RPS2004",
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
        let p = Double(marks) / Double(max) * 100
        if p >= 90 { return "A+" }
        if p >= 80 { return "A" }
        if p >= 70 { return "B+" }
        if p >= 60 { return "B" }
        if p >= 50 { return "C" }
        return "D"
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

    // MARK: Class broadcasts

    static func broadcasts(childId: String) -> [Broadcast] {
        switch childId {
        case "ch1":
            return [
                Broadcast(id: "b1", subject: "Mathematics", teacher: "Rajiv Mishra",
                          text: "Homework for Friday uploaded. Unit test syllabus is Chapters 5 to 7.",
                          attachment: "Math-Practice-Sheet.pdf", at: "2026-10-31T09:20:00Z"),
                Broadcast(id: "b2", subject: "Science", teacher: "Farhan Khan",
                          text: "Please bring chart paper and colours for Monday's project work.",
                          attachment: nil, at: "2026-10-30T10:10:00Z"),
                Broadcast(id: "b3", subject: "English", teacher: "Sunita Dwivedi",
                          text: "Read the story on page 84 and write five lines about your favourite character.",
                          attachment: nil, at: "2026-10-29T06:40:00Z"),
                Broadcast(id: "b4", subject: "General", teacher: "Rajiv Mishra",
                          text: "PTM slots for Class 8-B open on Saturday. Please confirm your slot with me.",
                          attachment: nil, at: "2026-10-28T05:15:00Z")
            ]
        case "ch2":
            return [
                Broadcast(id: "b5", subject: "General", teacher: "Sunita Dwivedi",
                          text: "PTM slots are open for booking.", attachment: nil, at: "2026-10-30T07:05:00Z"),
                Broadcast(id: "b6", subject: "Hindi", teacher: "Pooja Singh",
                          text: "Learn the poem 'Ek Bhi Aansoo' for recitation next week.",
                          attachment: "Hindi-Poem.pdf", at: "2026-10-29T08:00:00Z"),
                Broadcast(id: "b7", subject: "Science", teacher: "Farhan Khan",
                          text: "Science project guidelines attached.",
                          attachment: "Science-Project.pdf", at: "2026-10-28T06:30:00Z")
            ]
        default:
            return [
                Broadcast(id: "b8", subject: "General", teacher: "Dinesh Gupta",
                          text: "Class 9-A: revision notes for Social Science are on the notice board.",
                          attachment: nil, at: "2026-10-12T06:00:00Z")
            ]
        }
    }

    // MARK: Personal threads (seed)

    struct ThreadSeed {
        let id: String
        let childId: String
        let teacher: String
        let role: String
    }

    static let threadSeeds: [ThreadSeed] = [
        ThreadSeed(id: "th1", childId: "ch1", teacher: "Rajiv Mishra", role: "Class teacher"),
        ThreadSeed(id: "th2", childId: "ch1", teacher: "Sunita Dwivedi", role: "English teacher"),
        ThreadSeed(id: "th3", childId: "ch1", teacher: "Farhan Khan", role: "Science teacher"),
        ThreadSeed(id: "th4", childId: "ch2", teacher: "Sunita Dwivedi", role: "Class teacher"),
        ThreadSeed(id: "th5", childId: "ch2", teacher: "Pooja Singh", role: "Hindi teacher"),
        ThreadSeed(id: "th6", childId: "ch3", teacher: "Dinesh Gupta", role: "Class teacher")
    ]

    static let seedMessages: [String: [ChatMessage]] = [
        "th1": [
            ChatMessage(id: "m1", mine: false, text: "Good morning. Aarav has missed two tests. Could we meet this week?", at: "2026-10-29T12:30:00Z"),
            ChatMessage(id: "m2", mine: true, text: "Thank you, sir. We will meet on Saturday.", at: "2026-10-29T12:45:00Z")
        ],
        "th2": [
            ChatMessage(id: "m3", mine: false, text: "Aarav's reading has improved a lot this month.", at: "2026-10-26T08:10:00Z")
        ],
        "th3": [
            ChatMessage(id: "m4", mine: true, text: "Sir, which chapters are in the science project?", at: "2026-10-30T11:00:00Z"),
            ChatMessage(id: "m5", mine: false, text: "Chapters 9 and 10. Guidelines are in the class feed.", at: "2026-10-30T11:20:00Z")
        ],
        "th4": [
            ChatMessage(id: "m6", mine: false, text: "Diya did very well in the recitation today.", at: "2026-10-30T07:30:00Z")
        ],
        "th5": [],
        "th6": [
            ChatMessage(id: "m7", mine: false, text: "We wish Ishita all the best for her new school.", at: "2026-10-15T09:00:00Z")
        ]
    ]

    // MARK: Fees (paise)

    static func invoices(childId: String) -> [Invoice] {
        switch childId {
        case "ch1":
            return [
                Invoice(id: "inv1", no: "INV-3001", period: "Term 2", dueOn: "2026-11-10",
                        totalPaise: 2_000_000, paidPaise: 1_000_000,
                        lines: [InvoiceLine(title: "Tuition", amountPaise: 1_500_000),
                                InvoiceLine(title: "Transport", amountPaise: 300_000),
                                InvoiceLine(title: "Activity", amountPaise: 200_000)],
                        payments: [Payment(id: "p1", receiptNo: "RCP-1042", mode: "UPI", amountPaise: 1_000_000, at: "2026-10-12T05:20:00Z")]),
                Invoice(id: "inv2", no: "INV-2901", period: "Term 1", dueOn: "2026-07-10",
                        totalPaise: 2_000_000, paidPaise: 2_000_000,
                        lines: [InvoiceLine(title: "Tuition", amountPaise: 1_500_000),
                                InvoiceLine(title: "Transport", amountPaise: 300_000),
                                InvoiceLine(title: "Activity", amountPaise: 200_000)],
                        payments: [Payment(id: "p2", receiptNo: "RCP-0871", mode: "Cash", amountPaise: 2_000_000, at: "2026-07-05T06:10:00Z")])
            ]
        case "ch2":
            return [
                Invoice(id: "inv3", no: "INV-3002", period: "Term 2", dueOn: "2026-11-10",
                        totalPaise: 1_850_000, paidPaise: 0,
                        lines: [InvoiceLine(title: "Tuition", amountPaise: 1_400_000),
                                InvoiceLine(title: "Transport", amountPaise: 300_000),
                                InvoiceLine(title: "Activity", amountPaise: 150_000)],
                        payments: []),
                Invoice(id: "inv4", no: "INV-2902", period: "Term 1", dueOn: "2026-07-10",
                        totalPaise: 1_850_000, paidPaise: 1_850_000,
                        lines: [InvoiceLine(title: "Tuition", amountPaise: 1_400_000),
                                InvoiceLine(title: "Transport", amountPaise: 300_000),
                                InvoiceLine(title: "Activity", amountPaise: 150_000)],
                        payments: [Payment(id: "p3", receiptNo: "RCP-0872", mode: "Cheque", amountPaise: 1_850_000, at: "2026-07-06T04:40:00Z")])
            ]
        default:
            return [
                Invoice(id: "inv5", no: "INV-2950", period: "Term 1", dueOn: "2026-07-10",
                        totalPaise: 1_900_000, paidPaise: 1_900_000,
                        lines: [InvoiceLine(title: "Tuition", amountPaise: 1_900_000)],
                        payments: [Payment(id: "p4", receiptNo: "RCP-0900", mode: "UPI", amountPaise: 1_900_000, at: "2026-07-08T05:00:00Z")])
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
}
