import Foundation

enum NotificationKind: String, Hashable {
    case attendancePresent, attendanceAbsent, attendanceFirstHalf, attendanceSecondHalf
    case feeReminder, notice, examDateSheet, resultPublished, feedbackRequested, message
}

/// The groups that Settings > Notifications can switch on or off.
enum NotificationCategory: String, CaseIterable, Identifiable {
    case attendance, fees, notices, results, messages

    var id: String { rawValue }
    var storageKey: String { "notify." + rawValue }

    var title: String {
        switch self {
        case .attendance: return L.t("notif.cat.attendance")
        case .fees: return L.t("notif.cat.fees")
        case .notices: return L.t("notif.cat.notices")
        case .results: return L.t("notif.cat.results")
        case .messages: return L.t("notif.cat.messages")
        }
    }

    /// On by default.
    var isEnabled: Bool {
        UserDefaults.standard.object(forKey: storageKey) as? Bool ?? true
    }
}

/// Where a notification (or a push payload `deepLink`, e.g. "scool://fees") leads.
enum DeepLink: String, Hashable {
    case attendance, fees, notices, exams, results, feedback, messages

    init?(url: String) {
        let name = url.replacingOccurrences(of: "scool://", with: "")
        self.init(rawValue: name)
    }
}

/// Named AppNotification so it never clashes with Foundation's `Notification`.
/// Texts are built at display time from these fields.
struct AppNotification: Identifiable, Hashable {
    let id: String
    let kind: NotificationKind
    let childId: String
    let childName: String       // first name, used in the sentence and in the tag
    let at: String              // UTC ISO timestamp, shown in IST
    var isRead: Bool
    var detail = ""             // notice title, exam name or teacher name
    var amountPaise = 0         // fee reminder
    var dueOn = ""              // fee reminder, date-only

    var category: NotificationCategory {
        switch kind {
        case .attendancePresent, .attendanceAbsent, .attendanceFirstHalf, .attendanceSecondHalf: return .attendance
        case .feeReminder: return .fees
        case .notice, .examDateSheet, .feedbackRequested: return .notices
        case .resultPublished: return .results
        case .message: return .messages
        }
    }

    var deepLink: DeepLink {
        switch kind {
        case .attendancePresent, .attendanceAbsent, .attendanceFirstHalf, .attendanceSecondHalf: return .attendance
        case .feeReminder: return .fees
        case .notice: return .notices
        case .examDateSheet: return .exams
        case .resultPublished: return .results
        case .feedbackRequested: return .feedback
        case .message: return .messages
        }
    }

    var systemImage: String {
        switch kind {
        case .attendancePresent: return "checkmark.circle"
        case .attendanceAbsent: return "xmark.circle"
        case .attendanceFirstHalf, .attendanceSecondHalf: return "circle.lefthalf.filled"
        case .feeReminder: return "indianrupeesign.circle"
        case .notice: return "megaphone"
        case .examDateSheet: return "calendar.badge.clock"
        case .resultPublished: return "doc.text"
        case .feedbackRequested: return "star.bubble"
        case .message: return "bubble.left"
        }
    }

    var title: String {
        switch kind {
        case .attendancePresent, .attendanceAbsent, .attendanceFirstHalf, .attendanceSecondHalf:
            return L.t("notif.title.attendance")
        case .feeReminder: return L.t("notif.title.fee")
        case .notice: return L.t("notif.title.notice")
        case .examDateSheet: return L.t("notif.title.exam")
        case .resultPublished: return L.t("notif.title.result")
        case .feedbackRequested: return L.t("notif.title.feedback")
        case .message: return L.t("notif.title.message")
        }
    }

    var body: String {
        switch kind {
        case .attendancePresent: return L.f("notif.body.present", childName)
        case .attendanceAbsent: return L.f("notif.body.absent", childName)
        case .attendanceFirstHalf: return L.f("notif.body.first_half", childName)
        case .attendanceSecondHalf: return L.f("notif.body.second_half", childName)
        case .feeReminder: return L.f("notif.body.fee", childName, Money.format(paise: amountPaise), IST.date(dueOn))
        case .notice: return detail
        case .examDateSheet: return L.f("notif.body.exam", detail, childName)
        case .resultPublished: return L.f("notif.body.result", detail, childName)
        case .feedbackRequested: return L.f("notif.body.feedback", childName)
        case .message: return L.f("notif.body.message", detail, childName)
        }
    }
}
