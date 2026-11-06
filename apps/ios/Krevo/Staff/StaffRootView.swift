import SwiftUI

/// The staff app: a teacher or admin signed in. Tabs follow what the person may do.
/// Admin sees everything. A class teacher gets Attendance and Leave. Any other teacher gets Home, Students and More.
struct StaffRootView: View {
    enum Tab: Hashable { case home, attendance, students, leave, more }

    let context: StaffContext
    @State private var tab: Tab = .home

    var body: some View {
        TabView(selection: $tab) {
            StaffHomeView(go: { tab = $0 })
                .tabItem { Label("Home", systemImage: "house") }
                .tag(Tab.home)

            if context.access.canMarkAttendance {
                StaffAttendanceView()
                    .tabItem { Label("Classes", systemImage: "square.grid.2x2") }
                    .tag(Tab.attendance)
            }

            StaffStudentsView()
                .tabItem { Label("Students", systemImage: "person.2") }
                .tag(Tab.students)

            if context.access.canMarkAttendance {
                StaffLeaveView()
                    .tabItem { Label("Leave", systemImage: "calendar.badge.minus") }
                    .badge(context.pendingLeaves)
                    .tag(Tab.leave)
            }

            StaffMoreView()
                .tabItem { Label("More", systemImage: "ellipsis") }
                .tag(Tab.more)
        }
        .tint(Tokens.solid)
        .chromeTabBar()
        .environment(context)
        .task {
            await context.loadClasses()
            await context.refreshPendingLeaves()
        }
    }
}
