import SwiftUI

/// Routes by session phase: login, forced password change, parent app, staff placeholder.
struct RootView: View {
    @Environment(Session.self) private var session

    var body: some View {
        Group {
            switch session.phase {
            case .signedOut:
                LoginView()
            case .mustChangePassword:
                ChangePasswordView(isForced: true)
            case .parent:
                MainTabView()
            case .staff:
                StaffPlaceholderView()
            }
        }
        .background(Tokens.bg.ignoresSafeArea())
        .animation(.easeInOut(duration: 0.2), value: session.phase)
    }
}
