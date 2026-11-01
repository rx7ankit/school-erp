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

    var errorDescription: String? {
        switch self {
        case .invalidCredentials: return "Wrong email or password. Please try again."
        case .weakPassword: return "Password must be at least 8 characters with a letter and a number."
        case .notFound: return "We could not find that."
        case .notImplemented: return "This is not connected to the server yet."
        }
    }
}
