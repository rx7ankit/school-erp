import SwiftUI

/// The Academic tab: classes, students, leave, timetable and announcements as a plain list. Only for whoever holds the
/// Academic permission; teachers reach their own classes and students from Home instead.
struct StaffAcademicView: View {
    enum Route: Hashable { case classes, students, leave, timetable, announcements }

    @Environment(StaffContext.self) private var context

    var body: some View {
        NavigationStack {
            ScreenScroll {
                VStack(spacing: 0) {
                    row("Classes", "square.grid.2x2", .classes)
                    row("Students", "person.2", .students)
                    if context.access.canMarkAttendance { row("Leave requests", "calendar.badge.minus", .leave, badge: context.pendingLeaves) }
                    row("Timetable", "tablecells", .timetable)
                    row("Announcements", "megaphone", .announcements, last: true)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Route.self) { route in
                switch route {
                case .classes: StaffAttendanceView(embedded: true).hidesTabBar()
                case .students: StaffStudentsView(embedded: true).hidesTabBar()
                case .leave: StaffLeaveView(embedded: true).hidesTabBar()
                case .timetable: StaffTimetableView().hidesTabBar()
                case .announcements: StaffAnnouncementsView().hidesTabBar()
                }
            }
        }
    }

    private func row(_ title: String, _ icon: String, _ route: Route, badge: Int = 0, last: Bool = false) -> some View {
        NavigationLink(value: route) {
            PlainRow(title: title, showsDivider: !last, inset: 38,
                     accessory: badge > 0 ? AnyView(
                        Text("\(badge)").font(.sc(.caption, weight: .bold)).foregroundStyle(Tokens.onAccent)
                            .frame(minWidth: 22, minHeight: 22).background(Tokens.accent, in: Capsule())
                     ) : nil) {
                Image(systemName: icon).font(.system(size: 18, weight: .regular)).foregroundStyle(Tokens.text).frame(width: 26)
            }
        }
        .buttonStyle(.pressable)
    }
}
