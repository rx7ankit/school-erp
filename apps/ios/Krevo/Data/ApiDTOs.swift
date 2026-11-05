import Foundation

// Shapes of the parent-side API responses. Decoded with snake_case keys, then mapped to the app's own models
// in ApiRepository, so no screen depends on the wire format.

struct MeDTO: Decodable {
    let id: String
    let name: String
    let kind: String
    let isAdmin: Bool
    let mustChangePassword: Bool
}

struct ChildDTO: Decodable {
    let studentId: String
    let name: String
    let classLabel: String?
    let rollNo: Int?
    let scholarNo: String
    let status: String
    let readOnly: Bool
}

struct ChildGuardianDTO: Decodable {
    let name: String
    let relation: String
    let phone: String?
}

struct ChildDetailDTO: Decodable {
    let dob: String?
    let guardians: [ChildGuardianDTO]
}

struct TeacherDTO: Decodable {
    let name: String
    let tag: String
}

struct CalendarDTO: Decodable {
    struct Day: Decodable {
        let dayOn: String
        let firstHalf: String?
        let secondHalf: String?
        let holiday: String?
        let status: String
    }
    let days: [Day]
}

struct ExamRefDTO: Decodable { let id: String; let name: String }

struct ResultRowDTO: Decodable {
    let exam: ExamRefDTO
    let percentage: Double?
    let publishedAt: String
}

struct ResultDetailDTO: Decodable {
    struct Paper: Decodable { let maxMarks: Int; let subject: String; let subjectId: String }
    struct Mark: Decodable { let absent: Bool; let grade: String?; let marksObtained: Double?; let subjectId: String }
    let exam: ExamRefDTO
    let marks: [Mark]
    let papers: [Paper]
    let publishedAt: String?
    let remark: String?
}

struct FeedItemDTO: Decodable {
    struct Attachment: Decodable { let filename: String }
    let id: String
    let title: String
    let body: String
    let createdAt: String
    let isRead: Bool
    let scope: String
    let senderName: String
    let tag: String
    let attachments: [Attachment]
}

struct ThreadDTO: Decodable {
    let id: String
    let active: Bool
    let lastMessageAt: String?
    let lastMessagePreview: String?
    let tag: String
    let teacherName: String
    let unread: Int
}

struct MessageDTO: Decodable {
    struct Attachment: Decodable { let id: String; let filename: String; let contentType: String; let sizeBytes: Int }
    let id: String
    let body: String
    let createdAt: String
    let mine: Bool
    let attachments: [Attachment]

    var model: ThreadMessage {
        ThreadMessage(id: id, mine: mine, text: body, at: createdAt,
                      attachments: attachments.map { MessageAttachment(id: $0.id, filename: $0.filename, contentType: $0.contentType, sizeBytes: $0.sizeBytes) })
    }
}

struct FeesDTO: Decodable {
    struct Row: Decodable { let id: String }
    let invoices: [Row]
}

struct InvoiceDetailDTO: Decodable {
    struct Item: Decodable { let amountPaise: Int; let description: String; let kind: String }
    struct Payment: Decodable {
        let id: String
        let amountPaise: Int
        let mode: String
        let reference: String?
        let receiptNo: String
        let receivedAt: String
        let receivedByName: String?
        let status: String
    }
    let id: String
    let invoiceNo: String
    let periodLabel: String
    let dueOn: String
    let items: [Item]
    let payments: [Payment]
}

struct HolidayDTO: Decodable {
    let id: String
    let fromOn: String
    let toOn: String
    let kind: String
    let title: String
}

struct FeedbackDTO: Decodable {
    struct Target: Decodable {
        let myComment: String?
        let myRating: Int?
        let subject: String?
        let targetId: String
        let teacher: String
    }
    let requestId: String
    let studentId: String
    let closesOn: String
    let targets: [Target]
    let title: String
}

struct InboxDTO: Decodable {
    struct Item: Decodable {
        let id: String
        let title: String
        let body: String
        let createdAt: String
        let isRead: Bool?
        let readAt: String?
        let kind: String
        let studentId: String?
    }
    let items: [Item]
}

struct ScheduleDTO: Decodable {
    struct Paper: Decodable { let className: String; let paperOn: String; let startsAt: String; let subject: String; let subjectId: String }
    let id: String
    let items: [Paper]
    let name: String
}

struct LeaveDTO: Decodable {
    let id: String
    let studentId: String
    let fromOn: String
    let toOn: String
    let half: String
    let reason: String
    let status: String
    let decisionNote: String?
    let createdAt: String
}

struct ChildTimetableDTO: Decodable {
    struct Period: Decodable { let number: Int; let startsAt: String; let endsAt: String; let name: String }
    struct Slot: Decodable { let periodNumber: Int; let weekday: Int; let subjectName: String; let staffName: String }
    struct Entry: Decodable { let slot: Slot; let substituteName: String? }
    let classLabel: String
    let on: String
    let periods: [Period]
    let slots: [Slot]
    let today: [Entry]
}

struct EmptyBody: Decodable {}
