import SwiftUI

/// More: the places that do not need a tab, as a plain list in groups. Your own profile is behind the picture on Home.
struct StaffMoreView: View {
    enum Route: Hashable { case timetable, messages, announcements, fees, directory }

    @Environment(StaffContext.self) private var context
    @Environment(Session.self) private var session

    var body: some View {
        NavigationStack {
            ScreenScroll {
                GroupHeading("Teaching")
                VStack(spacing: 0) {
                    row("My timetable", "tablecells", .timetable)
                    row("Messages", "bubble.left.and.bubble.right", .messages)
                    row("Announcements", "megaphone", .announcements, last: true)
                }

                if context.access.canSeeFees || context.access.canSeeStaff {
                    GroupHeading("School")
                    VStack(spacing: 0) {
                        if context.access.canSeeFees { row("Fees", "indianrupeesign.circle", .fees, last: !context.access.canSeeStaff) }
                        if context.access.canSeeStaff { row("Staff", "person.2", .directory, last: true) }
                    }
                }

                Button { session.signOut() } label: {
                    Text("Sign out").font(.sc(.body, weight: .medium)).foregroundStyle(Tokens.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 14)
                }
                .buttonStyle(.pressable)
                .padding(.top, Tokens.Space.s5)
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Route.self) { route in
                switch route {
                case .timetable: StaffTimetableView().hidesTabBar()
                case .messages: StaffMessagesView().hidesTabBar()
                case .announcements: StaffAnnouncementsView().hidesTabBar()
                case .fees: StaffFeesView().hidesTabBar()
                case .directory: StaffDirectoryView().hidesTabBar()
                }
            }
        }
    }

    private func row(_ title: String, _ icon: String, _ route: Route, last: Bool = false) -> some View {
        NavigationLink(value: route) {
            PlainRow(title: title, showsDivider: !last, inset: 38) {
                Image(systemName: icon).font(.system(size: 18, weight: .regular)).foregroundStyle(Tokens.text).frame(width: 26)
            }
        }
        .buttonStyle(.pressable)
    }
}
