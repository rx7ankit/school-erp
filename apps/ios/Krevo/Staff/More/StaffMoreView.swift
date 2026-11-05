import SwiftUI

struct StaffMoreView: View {
    enum Route: Hashable { case timetable, messages, announcements, fees, directory, profile }

    @Environment(StaffContext.self) private var context
    @Environment(Session.self) private var session

    var body: some View {
        NavigationStack {
            ScreenScroll {
                StaffHeader(ink: "More", grey: "")
                row("My timetable", "tablecells", .timetable)
                row("Messages", "bubble.left.and.bubble.right", .messages)
                row("Announcements", "megaphone", .announcements)
                if context.access.canSeeFees { row("Fees", "indianrupeesign.circle", .fees) }
                if context.access.canSeeStaff { row("Staff", "person.2", .directory) }
                row("Profile", "person.crop.circle", .profile)

                PrimaryButton(title: "Sign out", style: .solid) { session.signOut() }
                    .padding(.top, Tokens.Space.s4)
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Route.self) { route in
                switch route {
                case .timetable: StaffTimetableView()
                case .messages: StaffMessagesView()
                case .announcements: StaffAnnouncementsView()
                case .fees: StaffFeesView()
                case .directory: StaffDirectoryView()
                case .profile: StaffProfileView()
                }
            }
        }
    }

    private func row(_ title: String, _ icon: String, _ route: Route) -> some View {
        NavigationLink(value: route) {
            Card {
                HStack(spacing: Tokens.Space.s3) {
                    Image(systemName: icon).font(.system(size: 20)).frame(width: 28)
                    Text(title).font(.sc(.body, weight: .medium))
                    Spacer()
                    Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Tokens.textTertiary)
                }
                .foregroundStyle(Tokens.text)
                .frame(minHeight: Tokens.Control.md)
            }
        }
        .buttonStyle(.pressable)
    }
}
