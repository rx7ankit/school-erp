import Foundation
import Observation

@Observable
@MainActor
final class ChangePasswordViewModel {
    var newPassword = ""
    var confirm = ""
    var errorText: String?
    var isLoading = false

    static let rulesHint = "At least 8 characters, with a letter and a number."

    var canSubmit: Bool { !newPassword.isEmpty && !confirm.isEmpty }

    /// Returns an error message, or nil when the password is acceptable.
    static func validate(_ password: String, confirm: String) -> String? {
        if password.count < 8 || !password.contains(where: { $0.isLetter }) || !password.contains(where: { $0.isNumber }) {
            return AppError.weakPassword.localizedDescription
        }
        if password != confirm { return "The two passwords do not match." }
        return nil
    }

    /// Returns true on success.
    func submit(session: Session) async -> Bool {
        if let problem = Self.validate(newPassword, confirm: confirm) {
            errorText = problem
            return false
        }
        isLoading = true
        errorText = nil
        defer { isLoading = false }
        do {
            try await session.changePassword(newPassword)
            return true
        } catch {
            errorText = error.localizedDescription
            return false
        }
    }
}
