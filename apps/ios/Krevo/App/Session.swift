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
    /// Set while a teacher or admin is signed in. Holds the repository (live or demo) and who they are.
    private(set) var staff: StaffContext?
    private var token = ""
    private var pushToken: String?

    init(repo: any Repository = MockRepository()) {
        self.repo = repo
    }

    func signIn(email: String, password: String) async throws {
        let key = email.trimmingCharacters(in: .whitespaces).lowercased()
        // Demo accounts (README) stay on offline mock data. Every other address is a real school login.
        guard MockData.accounts[key] != nil else { try await signInLive(email: key, password: password); return }
        let auth = try await repo.login(email: email, password: password)
        token = auth.accessToken
        user = auth.user
        if auth.user.kind == .staff {
            try await enterStaff(DemoStaffRepository(role: key == "teacher@demo.in" ? .teacher : .admin))
        } else if auth.user.mustChangePassword {
            phase = .mustChangePassword
        } else {
            try await enterParent()
        }
    }

    /// Teachers and admins sign in against the real API. Parents and platform owners are not served by this app yet.
    private func signInLive(email: String, password: String) async throws {
        let api = StaffAPI()
        let result = try await api.login(email: email, password: password)
        guard result.kind == "staff" else {
            api.signOut()
            throw StaffError(result.kind == "owner"
                ? "Platform owners sign in on the web."
                : "Parent sign-in is not connected to the school server yet. Use the demo parent login for now.")
        }
        guard !result.mustChangePassword else {
            api.signOut()
            throw StaffError("Set your own password on the web app first, then sign in here.")
        }
        try await enterStaff(LiveStaffRepository(api: api))
    }

    private func enterStaff(_ repository: any StaffRepository) async throws {
        let me = try await repository.me()
        user = User(id: me.id, name: me.name, kind: .staff, mustChangePassword: false)
        staff = StaffContext(repo: repository, me: me)
        phase = .staff
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

    /// Tells the backend the parent's language (PATCH /parent/preferences). Fire and forget.
    /// Does nothing before sign-in; `enterParent` sends the current choice once a parent is in.
    func syncLanguage(_ code: String) {
        guard phase == .parent else { return }
        let repo = self.repo
        Task { try? await repo.setLanguage(code) }
    }

    func signOut() {
        staff?.repo.signOut()
        staff = nil
        token = ""
        user = nil
        children = []
        phase = .signedOut
    }

    private func enterParent() async throws {
        children = try await repo.children(token: token)
        phase = .parent
        sendPushToken()
        syncLanguage(AppLanguage.current.rawValue)
        Task { await PushRegistration.start() }
    }
}
