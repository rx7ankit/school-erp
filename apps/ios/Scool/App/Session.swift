import Foundation
import Observation

/// Signed-in state and routing. Owns the repository used by every screen.
@Observable
@MainActor
final class Session {
    enum Phase {
        case signedOut
        case mustChangePassword
        case parent
        case staff
    }

    let repo: any Repository
    private(set) var phase: Phase = .signedOut
    private(set) var user: User?
    private(set) var children: [Child] = []
    private var token = ""
    private var pushToken: String?

    init(repo: any Repository = MockRepository()) {
        self.repo = repo
    }

    func signIn(email: String, password: String) async throws {
        let auth = try await repo.login(email: email, password: password)
        token = auth.accessToken
        user = auth.user
        if auth.user.kind == .staff {
            phase = .staff
        } else if auth.user.mustChangePassword {
            phase = .mustChangePassword
        } else {
            try await enterParent()
        }
    }

    func changePassword(_ newPassword: String) async throws {
        try await repo.changePassword(token: token, newPassword: newPassword)
        if phase == .mustChangePassword {
            try await enterParent()
        }
    }

    /// Called with the APNs token. Sent to the backend once a parent is signed in.
    func setPushToken(_ value: String) {
        pushToken = value
        sendPushToken()
    }

    private func sendPushToken() {
        guard phase == .parent, let value = pushToken else { return }
        let repo = self.repo
        Task { try? await repo.registerDevice(token: value, platform: "ios") }
    }

    func signOut() {
        token = ""
        user = nil
        children = []
        phase = .signedOut
    }

    private func enterParent() async throws {
        children = try await repo.children(token: token)
        phase = .parent
        sendPushToken()
        Task { await PushRegistration.start() }
    }
}
