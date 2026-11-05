import SwiftUI

struct StaffHomeView: View {
    let go: (StaffRootView.Tab) -> Void

    @Environment(StaffContext.self) private var context
    @State private var dashboard = Loader<StaffDashboard>()
    @State private var today = Loader<StaffDay>()

    private var firstName: String { context.me.name.split(separator: " ").first.map(String.init) ?? context.me.name }

    var body: some View {
        NavigationStack {
            ScreenScroll {
                StaffHeader(ink: "Hi, \(firstName).", grey: IST.weekdayName(on: IST.todayOn()) + ".")

                HStack(spacing: Tokens.Space.s2) {
                    Pill(text: context.access.roleTitle, tone: .accent)
                    if let school = context.me.school { Pill(text: school.name) }
                }

                LoadableView(dashboard.state, retry: { Task { await reload() } }, skeleton: {
                    LazyVGrid(columns: grid, spacing: Tokens.Space.s3) {
                        ForEach(0..<4, id: \.self) { _ in SkeletonCard { VStack(alignment: .leading, spacing: 8) { SkeletonLine(width: 70, role: .caption); SkeletonLine(width: 90, role: .title2) } } }
                    }
                }) { d in stats(d) }

                if context.access.canMarkAttendance, let d = dashboard.state.value, d.attendance.classesMarkedToday < d.attendance.classesTotal {
                    PrimaryButton(title: "Mark today's attendance", style: .brand) { go(.attendance) }
                }
                if context.pendingLeaves > 0 {
                    Button { go(.leave) } label: {
                        Card { HStack { Image(systemName: "calendar.badge.exclamationmark"); Text("\(context.pendingLeaves) leave \(context.pendingLeaves == 1 ? "request needs" : "requests need") your decision").font(.sc(.callout, weight: .medium)); Spacer(); Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Tokens.textTertiary) }.foregroundStyle(Tokens.text) }
                    }.buttonStyle(.plain)
                }

                SectionLabel("Your day")
                LoadableView(today.state, retry: { Task { await reload() } }) { day in
                    if day.entries.isEmpty {
                        EmptyNote(text: "No classes scheduled today.")
                    } else {
                        ForEach(day.entries.prefix(6)) { entry in StaffPeriodRow(entry: entry) }
                    }
                }
            }
            .refreshable { await reload() }
            .toolbar(.hidden, for: .navigationBar)
            .task { await reload() }
        }
    }

    private let grid = [GridItem(.flexible(), spacing: Tokens.Space.s3), GridItem(.flexible(), spacing: Tokens.Space.s3)]

    @ViewBuilder
    private func stats(_ d: StaffDashboard) -> some View {
        LazyVGrid(columns: grid, spacing: Tokens.Space.s3) {
            StatTile(label: "Students", value: "\(d.students)", hint: "\(d.classes) \(d.classes == 1 ? "class" : "classes")")
            StatTile(label: "Attendance today", value: percent(d.attendance.todayPercentage), hint: "\(d.attendance.classesMarkedToday) of \(d.attendance.classesTotal) classes marked")
            if let fees = d.fees {
                StatTile(label: "Collected this month", value: rupees(fees.collectedThisMonthPaise), hint: "\(rupees(fees.duesPaise)) dues")
                StatTile(label: "Overdue", value: rupees(fees.overduePaise), hint: "\(fees.duesStudents) students owe fees", tone: .danger)
            }
            if let staff = d.staff {
                StatTile(label: "Staff present", value: "\(staff.presentToday)/\(staff.activeStaff)", hint: staff.notMarkedToday > 0 ? "\(staff.notMarkedToday) not marked" : nil)
            }
            if d.fees == nil, d.staff == nil {
                StatTile(label: "This month", value: percent(d.attendance.monthPercentage), hint: "Attendance")
            }
            if let exam = d.results.exam {
                StatTile(label: "Average marks", value: percent(d.results.averagePercentage), hint: exam)
            }
        }
    }

    private func reload() async {
        async let a: () = dashboard.load { try await context.repo.dashboard() }
        async let b: () = today.load { try await context.repo.myDay(on: IST.todayOn()) }
        _ = await (a, b)
        await context.refreshPendingLeaves()
    }
}

/// One period of the day: time, subject, class.
struct StaffPeriodRow: View {
    let entry: StaffDayEntry

    var body: some View {
        Card {
            HStack(spacing: Tokens.Space.s3) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(Text.clock(entry.slot.startsAt)).font(.sc(.callout, weight: .semibold))
                    Text(entry.slot.periodName).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
                }
                .frame(width: 84, alignment: .leading)
                VStack(alignment: .leading, spacing: 2) {
                    Text(entry.slot.subjectName).font(.sc(.body, weight: .medium))
                    Text("Class \(entry.slot.classLabel)").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                }
                Spacer()
                if entry.substituteName != nil { Pill(text: "Cover", tone: .warning) }
                else if entry.role == "substitute" { Pill(text: "Substitute", tone: .accent) }
            }
        }
    }
}
