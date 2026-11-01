import Foundation

enum NotificationKind: String, Hashable {
    case attendancePresent, attendanceAbsent, attendanceFirstHalf, attendanceSecondHalf
    case feeReminder, notice, examDateSheet, resultPublished, feedbackRequested, message
    case leaveApproved, leaveRejected, reportCard
    case promotionPromoted, promotionStayed, promotionCompleted
    case broadcast          // class or school-level broadcast; school ones have subject "School"
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
    case home, attendance, fees, notices, exams, results, feedback, messages, leave

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
    var sender = ""             // broadcast sender or message teacher
    var classLabel = ""         // promotion: the class the text is about, e.g. "7-A"
    var academicYear = ""       // promotion: "2026-27"
    var subject = ""            // broadcast tag: "School", a subject or "General"; message subject

    var category: NotificationCategory {
        switch kind {
        case .attendancePresent, .attendanceAbsent, .attendanceFirstHalf, .attendanceSecondHalf: return .attendance
        case .leaveApproved, .leaveRejected: return .attendance
        case .feeReminder: return .fees
        case .notice, .examDateSheet, .feedbackRequested: return .notices
        case .resultPublished, .reportCard: return .results
        case .promotionPromoted, .promotionStayed, .promotionCompleted: return .results
        case .message, .broadcast: return .messages
        }
    }

    var deepLink: DeepLink {
        switch kind {
        case .attendancePresent, .attendanceAbsent, .attendanceFirstHalf, .attendanceSecondHalf: return .attendance
        case .feeReminder: return .fees
        case .notice: return .notices
        case .examDateSheet: return .exams
        case .resultPublished, .reportCard: return .results
        case .feedbackRequested: return .feedback
        case .message, .broadcast: return .messages
        case .leaveApproved, .leaveRejected: return .leave
        case .promotionPromoted, .promotionStayed, .promotionCompleted: return .home
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
        case .broadcast: return "megaphone"
        case .promotionPromoted, .promotionCompleted: return "sparkles"
        case .promotionStayed: return "graduationcap"
        case .leaveApproved: return "checkmark.seal"
        case .leaveRejected: return "xmark.seal"
        case .reportCard: return "doc.richtext"
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
        case .message: return sender
        case .broadcast:
            return subject == Update.schoolTag
                ? L.t("notif.title.school_notice")
                : L.f("notif.title.broadcast", sender, L.known("subject", subject))
        case .leaveApproved, .leaveRejected: return L.t("notif.title.leave")
        case .reportCard: return L.t("notif.title.report_card")
        case .promotionPromoted, .promotionStayed, .promotionCompleted: return L.t("notif.title.promotion")
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
        case .message, .broadcast: return detail
        case .leaveApproved: return L.f("notif.body.leave_approved", childName)
        case .leaveRejected: return L.f("notif.body.leave_rejected", childName)
        case .reportCard: return L.f("notif.body.report_card", childName)
        case .promotionPromoted: return L.f("notif.body.promoted", childName, classLabel, academicYear)
        case .promotionStayed: return L.f("notif.body.stayed", childName, classLabel, academicYear)
        case .promotionCompleted: return L.f("notif.body.completed", childName, classLabel)
        }
    }

    /// Promoted and completed get a congratulations card on Home. Staying does not.
    var isCelebration: Bool {
        kind == .promotionPromoted || kind == .promotionCompleted
    }
}
