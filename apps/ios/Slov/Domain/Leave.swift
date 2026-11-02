import Foundation

enum LeaveHalf: String, CaseIterable, Identifiable, Hashable {
    case none, first, second

    var id: String { rawValue }

    var title: String {
        switch self {
        case .none: return L.t("leave.full_day")
        case .first: return L.t("leave.first_half")
        case .second: return L.t("leave.second_half")
        }
    }
}

enum LeaveStatus: String, Hashable {
    case pending, approved, rejected, cancelled

    var title: String {
        switch self {
        case .pending: return L.t("leave.status.pending")
        case .approved: return L.t("leave.status.approved")
        case .rejected: return L.t("leave.status.rejected")
        case .cancelled: return L.t("leave.status.cancelled")
        }
    }

    var tone: Pill.Tone {
        switch self {
        case .pending: return .warning
        case .approved: return .success
        case .rejected: return .danger
        case .cancelled: return .neutral
        }
    }
}

struct LeaveRequest: Identifiable, Hashable {
    let id: String
    let childId: String
    let fromOn: String          // date-only, IST calendar date
    let toOn: String            // date-only
    let half: LeaveHalf
    let reason: String
    var status: LeaveStatus
    var decisionNote: String?   // teacher's note on approved / rejected
    let createdAt: String       // UTC ISO
}

/// Rules shared by the form and the repository.
enum LeaveRules {
    static let maxReasonLength = 200

    /// Returns the first problem found, or nil when the request is acceptable.
    static func validate(from: String, to: String, half: LeaveHalf, reason: String, today: String) -> AppError? {
        if from < today { return .leavePast }
        if to < from { return .leaveDates }
        if half != .none && from != to { return .leaveHalfSingleDay }
        let trimmed = reason.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return .leaveReasonRequired }
        if trimmed.count > maxReasonLength { return .leaveReasonTooLong }
        return nil
    }
}
