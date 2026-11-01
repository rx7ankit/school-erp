import SwiftUI

/// Five tabs. The selected child lives here (persisted with @AppStorage) and is
/// handed to every tab; `.id(child.id)` rebuilds each tab when the child changes.
struct MainTabView: View {
    enum Tab: Hashable {
        case home, attendance, results, messages, more
    }

    @Environment(Session.self) private var session
    @AppStorage("selectedChildId") private var selectedChildId = ""
    @State private var tab: Tab = .home

    private var child: Child? {
        session.children.first(where: { $0.id == selectedChildId }) ?? session.children.first
    }

    var body: some View {
        if let child {
            TabView(selection: $tab) {
                HomeView(child: child, children: session.children, onSelect: { selectedChildId = $0.id })
                    .id(child.id)
                    .tabItem { Label("Home", systemImage: "house") }
                    .tag(Tab.home)

                AttendanceView(child: child)
                    .id(child.id)
                    .tabItem { Label("Attendance", systemImage: "calendar") }
                    .tag(Tab.attendance)

                ResultsView(child: child)
                    .id(child.id)
                    .tabItem { Label("Results", systemImage: "doc.text") }
                    .tag(Tab.results)

                MessagesView(child: child)
                    .id(child.id)
                    .tabItem { Label("Messages", systemImage: "bubble.left.and.bubble.right") }
                    .tag(Tab.messages)

                MoreView(child: child)
                    .id(child.id)
                    .tabItem { Label("More", systemImage: "ellipsis") }
                    .tag(Tab.more)
            }
            .tint(Tokens.accent)
            .chromeTabBar()
        } else {
            EmptyNote(text: "No children are linked to this account yet. Please contact the school office.")
                .padding(20)
        }
    }
}
