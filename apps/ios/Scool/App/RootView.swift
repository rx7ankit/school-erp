import SwiftUI

/// Routes by session phase: first-launch language chooser, login, forced password change, parent app, staff placeholder.
struct RootView: View {
    @Environment(Session.self) private var session
    @Environment(LanguageStore.self) private var language

    var body: some View {
        Group {
            if !language.hasChosen {
                // First launch: pick English or Hindi before anything else.
                LanguageChooserView()
            } else {
                switch session.phase {
                case .signedOut:
                    // `.id` rebuilds the screen when the language changes, so every string refreshes at once.
                    LoginView().id(language.language)
                case .mustChangePassword:
                    ChangePasswordView(isForced: true).id(language.language)
                case .parent:
                    MainTabView()
                case .staff:
                    // The staff app stays English-only.
                    StaffPlaceholderView()
                }
            }
        }
        .background(Tokens.bg.ignoresSafeArea())
        .animation(.easeInOut(duration: 0.2), value: session.phase)
    }
}
