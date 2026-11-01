import Foundation

struct Broadcast: Identifiable {
    let id: String
    let subject: String
    let teacher: String
    let text: String
    let attachment: String?
    let at: String
}

struct MessageThread: Identifiable, Hashable {
    let id: String
    let teacher: String
    let role: String          // "Class teacher" or "English teacher"
    let lastText: String
    let lastAt: String
}

struct ChatMessage: Identifiable, Hashable {
    let id: String
    let mine: Bool
    let text: String
    let at: String
}
