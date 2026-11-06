import SwiftUI

/// The staff app. The tab bar comes from the server's layout: Home and Messages for everyone, then Academic, Fees and
/// only for whoever holds that permission. Everything else (people and access, sign out) is behind the picture on Home.
struct StaffRootView: View {
    enum Tab: String, Hashable { case home, messages, academic, fees }

    let context: StaffContext
    @State private var tab: Tab = .home
    @State private var reads: NoticeReads

    init(context: StaffContext) {
        self.context = context
        _reads = State(initialValue: NoticeReads(userId: context.me.id))
    }

    private func shows(_ name: String) -> Bool { context.layout.tabs.contains(name) }

    var body: some View {
        TabView(selection: $tab) {
            StaffHomeView(go: { tab = $0 })
                .tabItem { Label("Home", systemImage: "house") }
                .tag(Tab.home)

            StaffMessagesTab()
                .tabItem { Label("Messages", systemImage: "bubble.left.and.bubble.right") }
                .tag(Tab.messages)

            if shows("academic") {
                StaffAcademicView()
                    .tabItem { Label("Academic", systemImage: "graduationcap") }
                    .badge(context.pendingLeaves)
                    .tag(Tab.academic)
            }
            if shows("fees") {
                StaffFeesTab()
                    .tabItem { Label("Fees", systemImage: "indianrupeesign.circle") }
                    .tag(Tab.fees)
            }
        }
        .tint(Tokens.accent)
        .chromeTabBar()
        .environment(context)
        .environment(reads)
        .task {
            async let a: () = context.loadLayout()
            async let b: () = context.loadClasses()
            async let c: () = context.refreshPendingLeaves()
            _ = await (a, b, c)
        }
    }
}
