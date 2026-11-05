import Foundation

enum UpdateKind: Hashable {
    case school             // from the principal or academic team
    case classBroadcast     // from a teacher of the child's class
}

/// One item of the Updates feed. Parents cannot reply to it.
struct Update: Identifiable, Hashable {
    static let schoolTag = "School"
    static let generalTag = "General"

    let id: String
    let kind: UpdateKind
    let tag: String            // "School", a subject name, or "General"
    let sender: String
    var title: String = ""     // headline of the announcement, when the server sends one
    let text: String
    let attachment: String?
    let at: String             // UTC ISO, shown in IST
    var isRead: Bool
}

enum ThreadStatus: Hashable {
    case active
    case inactive              // the teacher no longer teaches this child: read-only
}

/// A private thread for one child, teacher and subject.
struct TeacherThread: Identifiable, Hashable {
    let id: String
    let teacher: String
    let subject: String
    let isClassTeacher: Bool
    let status: ThreadStatus
    let lastText: String       // empty when there are no messages yet
    let lastAt: String         // empty when there are no messages yet
    let unread: Int

    var isActive: Bool { status == .active }
}

struct ThreadMessage: Identifiable, Hashable {
    let id: String
    let mine: Bool
    let text: String
    let at: String
}
