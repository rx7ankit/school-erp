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
        /// Launching with a saved sign-in: checking it with the server before showing the app.
        case restoring
        /// A saved sign-in exists but the server could not be reached. Nothing is lost; the person can retry.
        case offline
    }

    let api: APIClient
    let repo: any Repository
    private(set) var phase: Phase
    private(set) var user: User?
    private(set) var children: [Child] = []
    /// Set while a teacher or admin is signed in. Holds the repository and who they are.
    private(set) var staff: StaffContext?
    private var token = ""
    private var pushToken: String?

    init() {
        let api = APIClient()
        self.api = api
        self.repo = ApiRepository(api: api)
        self.phase = api.hasSession ? .restoring : .signedOut
        // The server ended this sign-in (password changed, school suspended, signed out elsewhere): back to the login screen.
        api.onSessionEnded = { [weak self] in Task { @MainActor in self?.endedByServer() } }
    }

    private func endedByServer() {
        staff = nil; token = ""; user = nil; children = []
        phase = .signedOut
    }

    private struct Restored: Decodable {
        let id: String
        let name: String
        let kind: String
        let mustChangePassword: Bool
    }

    /// Called at launch. Signs the person straight back in from the saved tokens; they only see the login screen if the
    /// server refuses the saved sign-in. Shows the splash for a moment so the logo animation can play.
    func restore() async {
        guard phase == .restoring || phase == .offline else { return }
        phase = .restoring
        let started = Date()
        var next: Phase = .offline
        do {
            let me: Restored = try await api.get("/auth/me")
            token = api.accessToken
            if me.kind == "staff" {
                if me.mustChangePassword { api.signOut(); next = .signedOut }
                else { try await enterStaff(LiveStaffRepository(api: api)); phase = .restoring; next = .staff }
            } else if me.kind == "parent" {
                user = User(id: me.id, name: me.name, kind: .parent, mustChangePassword: me.mustChangePassword)
                if me.mustChangePassword { next = .mustChangePassword }
                else { try await enterParent(); phase = .restoring; next = .parent }
            } else {
                api.signOut(); next = .signedOut
            }
        } catch {
            next = api.hasSession ? .offline : .signedOut
        }
        let shown = Date().timeIntervalSince(started)
        if shown < 1.6 { try? await Task.sleep(nanoseconds: UInt64((1.6 - shown) * 1_000_000_000)) }
        phase = next
    }

    /// Parents, teachers and admins all sign in against the Krevo API. The account decides which app they get.
    func signIn(email: String, password: String) async throws {
        let auth = try await repo.login(email: email.trimmingCharacters(in: .whitespaces), password: password)
        token = auth.accessToken
        user = auth.user
        if auth.user.kind == .staff {
            guard !auth.user.mustChangePassword else {
                api.signOut()
                throw ApiError("Set your own password on the web app first, then sign in here.")
            }
            try await enterStaff(LiveStaffRepository(api: api))
        } else if auth.user.mustChangePassword {
            phase = .mustChangePassword
        } else {
            try await enterParent()
        }
    }

    private func enterStaff(_ repository: any StaffRepository) async throws {
        let me = try await repository.me()
        user = User(id: me.id, name: me.name, kind: .staff, mustChangePassword: false)
        staff = StaffContext(repo: repository, me: me, chat: ChatAPI(api: api, isParent: false))
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
        api.signOut()
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
