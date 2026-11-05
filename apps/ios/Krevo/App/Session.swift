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

    let api: APIClient
    let repo: any Repository
    private(set) var phase: Phase = .signedOut
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
