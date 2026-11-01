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

    var errorDescription: String? {
        switch self {
        case .invalidCredentials: return L.t("error.invalid_credentials")
        case .weakPassword: return L.t("error.weak_password")
        case .notFound: return L.t("error.not_found")
        case .notImplemented: return L.t("error.not_implemented")
        case .feedbackUnavailable: return L.t("error.feedback_unavailable")
        }
    }
}
