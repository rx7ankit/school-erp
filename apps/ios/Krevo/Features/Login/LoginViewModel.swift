import Foundation
import Observation

@Observable
@MainActor
final class LoginViewModel {
    var email = "" { didSet { errorText = nil } }
    var password = "" { didSet { errorText = nil } }
    var errorText: String?
    var isLoading = false

    var canSubmit: Bool {
        !email.trimmingCharacters(in: .whitespaces).isEmpty && !password.isEmpty
    }

    func submit(session: Session) async {
        guard canSubmit else {
            errorText = L.t("login.fill_both")
            return
        }
        isLoading = true
        errorText = nil
        do {
            try await session.signIn(email: email, password: password)
        } catch {
            errorText = error.localizedDescription
        }
        isLoading = false
    }
}
