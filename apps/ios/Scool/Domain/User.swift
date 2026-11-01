import Foundation

enum UserKind: String {
    case parent
    case staff
}

struct User: Equatable {
    let id: String
    let name: String
    let kind: UserKind
    let mustChangePassword: Bool
}

struct AuthSession {
    let accessToken: String
    let user: User
}

enum AppError: LocalizedError {
    case invalidCredentials
    case weakPassword
    case notFound
    case notImplemented
    case feedbackUnavailable
    case leaveDates
    case leavePast
    case leaveHalfSingleDay
    case leaveReasonRequired
    case leaveReasonTooLong
    case leaveNotPending
    case leaveLeftSchool
    case messagingClosed

    var errorDescription: String? {
        switch self {
        case .invalidCredentials: return L.t("error.invalid_credentials")
        case .weakPassword: return L.t("error.weak_password")
        case .notFound: return L.t("error.not_found")
        case .notImplemented: return L.t("error.not_implemented")
        case .feedbackUnavailable: return L.t("error.feedback_unavailable")
        case .leaveDates: return L.t("error.leave_dates")
        case .leavePast: return L.t("error.leave_past")
        case .leaveHalfSingleDay: return L.t("error.leave_half")
        case .leaveReasonRequired: return L.t("error.leave_reason")
        case .leaveReasonTooLong: return L.t("error.leave_reason_long")
        case .leaveNotPending: return L.t("error.leave_not_pending")
        case .leaveLeftSchool: return L.t("error.leave_left")
        case .messagingClosed: return L.t("error.messaging_closed")
        }
    }
}
