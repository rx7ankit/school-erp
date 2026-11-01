import SwiftUI

@main
struct ScoolApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var session = Session()
    @State private var router = Router()
    @AppStorage(Appearance.storageKey) private var appearance = Appearance.system.rawValue

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .environment(router)
                .onAppear {
                    AppDelegate.onToken = { token in session.setPushToken(token) }
                    AppDelegate.onOpen = { link, childId in router.open(link, childId: childId) }
                }
                .tint(Tokens.accent)
                .preferredColorScheme(Appearance(rawValue: appearance)?.colorScheme)
        }
    }
}
