import SwiftUI

/// Five tabs. The selected child lives here (persisted with @AppStorage) and is
/// handed to every tab; `.id(child.id)` rebuilds each tab when the child changes.
struct MainTabView: View {
    enum Tab: Hashable {
        case home, attendance, results, messages, more
    }

    @Environment(Session.self) private var session
    @Environment(Router.self) private var router
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
                    .tabItem { Label(L.t("tab.home"), systemImage: "house") }
                    .tag(Tab.home)

                AttendanceView(child: child)
                    .id(child.id)
                    .tabItem { Label(L.t("tab.attendance"), systemImage: "calendar") }
                    .tag(Tab.attendance)

                ResultsView(child: child)
                    .id(child.id)
                    .tabItem { Label(L.t("tab.results"), systemImage: "doc.text") }
                    .tag(Tab.results)

                MessagesView(child: child)
                    .id(child.id)
                    .tabItem { Label(L.t("tab.messages"), systemImage: "bubble.left.and.bubble.right") }
                    .tag(Tab.messages)

                MoreView(child: child)
                    .id(child.id)
                    .tabItem { Label(L.t("tab.more"), systemImage: "ellipsis") }
                    .tag(Tab.more)
            }
            .tint(Tokens.accent)
            .chromeTabBar()
            .onChange(of: router.request) { _, request in handle(request) }
        } else {
            EmptyNote(text: L.t("common.no_children"))
                .padding(20)
        }
    }

    /// Notification taps and push payloads: switch child if needed, then open the right tab or More screen.
    private func handle(_ request: Router.Request?) {
        guard let request else { return }
        if let id = request.childId, session.children.contains(where: { $0.id == id }) {
            selectedChildId = id
        }
        switch request.link {
        case .attendance: tab = .attendance
        case .results: tab = .results
        case .messages: tab = .messages
        case .fees: openMore(.fees)
        case .notices: openMore(.notices)
        case .exams: openMore(.exams)
        case .feedback: openMore(.feedback)
        }
        router.request = nil
    }

    private func openMore(_ route: MoreView.Route) {
        router.moreRoute = route
        tab = .more
    }
}
