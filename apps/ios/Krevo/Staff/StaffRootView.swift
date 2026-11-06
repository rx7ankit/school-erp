import SwiftUI

/// The staff app. The tab bar comes from the server's layout: Home and Messages for everyone, then Academic, Fees and
/// Library only for whoever holds that permission. Everything else (people and access, sign out) is behind the picture on Home.
struct StaffRootView: View {
    enum Tab: String, Hashable { case home, messages, academic, fees, library }

    let context: StaffContext
    @State private var tab: Tab = .home

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
            if shows("library") {
                StaffLibraryView()
                    .tabItem { Label("Library", systemImage: "books.vertical") }
                    .tag(Tab.library)
            }
        }
        .tint(Tokens.accent)
        .chromeTabBar()
        .environment(context)
        .task {
            async let a: () = context.loadLayout()
            async let b: () = context.loadClasses()
            async let c: () = context.refreshPendingLeaves()
            _ = await (a, b, c)
        }
    }
}
