import SwiftUI
import Charts

/// The staff home: what needs doing today, then the day's timetable, then (for people who may see them) the school's numbers.
/// Everything is gated by what the person may do: a teacher without fee access never sees fees here.
struct StaffHomeView: View {
    let go: (StaffRootView.Tab) -> Void

    @Environment(StaffContext.self) private var context
    @State private var dashboard = Loader<StaffDashboard>()
    @State private var today = Loader<StaffDay>()
    @State private var insight = Loader<AttendanceInsight>()
    @State private var fees = Loader<FeesSummary>()

    private var firstName: String { context.me.name.split(separator: " ").first.map(String.init) ?? context.me.name }
    private var access: StaffAccess { context.access }

    var body: some View {
        NavigationStack {
            ScreenScroll(hero: true) {
                TwoToneTitle(ink: "Hi,", grey: firstName, role: .title1)
                Text([access.roleTitle, context.me.school?.name].compactMap { $0 }.joined(separator: " · "))
                    .font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                    .padding(.top, -Tokens.Space.s2)

                LoadableView(dashboard.state, retry: { Task { await reload() } }, skeleton: {
                    SkeletonCard { VStack(alignment: .leading, spacing: 10) { SkeletonLine(width: 120, role: .caption); SkeletonLine(width: 90, role: .title1); SkeletonLine(role: .callout) } }
                }) { d in
                    todayCard(d)
                    attention(d)
                }

                // A teacher's own timetable matters most to them; admins look at the school first.
                if !access.isAdmin { yourDay }
                if access.isAdmin || access.canSeeFees { pulse }
                if access.isAdmin { yourDay }
            }
            .refreshable { await reload() }
            .toolbar(.hidden, for: .navigationBar)
            .task { await reload() }
        }
    }

    // MARK: Today

    /// One card: today's attendance as the headline, then up to three small numbers beneath.
    private func todayCard(_ d: StaffDashboard) -> some View {
        let a = d.attendance
        let marked = a.classesTotal == 0 ? 0 : Double(a.classesMarkedToday) / Double(a.classesTotal)
        return Card {
            VStack(alignment: .leading, spacing: Tokens.Space.s4) {
                VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                    Text("Attendance today").font(.sc(.caption, weight: .semibold)).foregroundStyle(Tokens.textSecondary).textCase(.uppercase)
                    HStack(alignment: .firstTextBaseline) {
                        if a.todayPercentage == nil {
                            Text("Not marked yet").font(.sc(.title3)).foregroundStyle(Tokens.textSecondary)
                        } else {
                            Text(percent(a.todayPercentage)).font(.sc(.title1)).foregroundStyle(Tokens.text).monospacedDigit()
                        }
                        Spacer()
                        Text("\(a.classesMarkedToday) of \(a.classesTotal) classes marked").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                    }
                    BrandProgress(fraction: marked)
                }
                Separator()
                HStack(alignment: .top, spacing: 0) {
                    miniStat("Students", "\(d.students)")
                    if let s = d.staff { miniStat("Staff in", "\(s.presentToday)/\(s.activeStaff)") }
                    if let f = d.fees { miniStat("Collected", compactRupees(f.collectedThisMonthPaise), hint: "this month") }
                    if d.staff == nil, d.fees == nil { miniStat("This month", percent(d.attendance.monthPercentage), hint: "attendance") }
                }
            }
        }
    }

    private func miniStat(_ label: String, _ value: String, hint: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
            Text(value).font(.sc(.title3)).foregroundStyle(Tokens.text).monospacedDigit().minimumScaleFactor(0.7).lineLimit(1)
            if let hint { Text(hint).font(.sc(.caption)).foregroundStyle(Tokens.textTertiary) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// What needs a decision or an action right now. Rows only appear when there is something to do.
    @ViewBuilder
    private func attention(_ d: StaffDashboard) -> some View {
        let unmarked = d.attendance.classesTotal - d.attendance.classesMarkedToday
        let showAttendance = access.canMarkAttendance && unmarked > 0
        let showLeave = access.canMarkAttendance && context.pendingLeaves > 0
        let showFees = access.canSeeFees && (d.fees?.overduePaise ?? 0) > 0
        if showAttendance || showLeave || showFees {
            ListCard {
                if showAttendance {
                    ListRow(icon: "checkmark.circle", title: "Mark today's attendance",
                            subtitle: access.isAdmin ? "\(unmarked) \(unmarked == 1 ? "class" : "classes") still to mark" : "Your class is waiting",
                            showsDivider: showLeave || showFees) { go(.attendance) }
                }
                if showLeave {
                    ListRow(icon: "calendar.badge.exclamationmark", tint: Tokens.warning,
                            title: "\(context.pendingLeaves) leave \(context.pendingLeaves == 1 ? "request" : "requests") to decide",
                            subtitle: "Parents are waiting for a reply", showsDivider: showFees) { go(.leave) }
                }
                if showFees, let f = d.fees {
                    ListRow(icon: "indianrupeesign.circle", tint: Tokens.danger, title: "\(rupees(f.overduePaise)) overdue",
                            subtitle: "\(f.duesStudents) students owe fees", showsDivider: false) { go(.more) }
                }
            }
        }
    }

    // MARK: School pulse

    /// Attendance over two weeks as a quiet line, and how much of the year's fees are in. One card, no axes.
    @ViewBuilder
    private var pulse: some View {
        let points = (insight.state.value?.trend ?? []).compactMap { t in t.percentage.map { (id: t.dayOn, date: IST.pickerDate(on: t.dayOn), value: $0) } }
        let feeSummary = access.canSeeFees ? fees.state.value : nil
        if points.count > 1 || (feeSummary?.billedPaise ?? 0) > 0 {
            SectionLabel("School this month")
            Card {
                VStack(alignment: .leading, spacing: Tokens.Space.s4) {
                    if points.count > 1 {
                        VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                            HStack {
                                Text("Attendance, 14 days").font(.sc(.callout, weight: .semibold))
                                Spacer()
                                if let overall = insight.state.value?.overallPercentage {
                                    Text(String(format: "%.1f%%", overall)).font(.sc(.callout, weight: .semibold)).monospacedDigit()
                                }
                            }
                            let low = max(0, (points.map(\.value).min() ?? 80) - 6)
                            Chart(points, id: \.id) { p in
                                LineMark(x: .value("Day", p.date), y: .value("Present", p.value))
                                    .interpolationMethod(.monotone)
                                    .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round))
                                    .foregroundStyle(Tokens.accent)
                            }
                            .chartYScale(domain: low...100)
                            .chartXAxis(.hidden)
                            .chartYAxis(.hidden)
                            .frame(height: 56)
                            .accessibilityLabel("Attendance over the last 14 days")
                        }
                    }
                    if let f = feeSummary, f.billedPaise > 0 {
                        if points.count > 1 { Separator() }
                        VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                            HStack {
                                Text("Fees collected").font(.sc(.callout, weight: .semibold))
                                Spacer()
                                Text("\(Int((f.collectionPercentage ?? 0).rounded()))%").font(.sc(.callout, weight: .semibold)).monospacedDigit()
                            }
                            BrandProgress(fraction: (f.collectionPercentage ?? 0) / 100)
                            Text("\(rupees(f.collectedPaise)) of \(rupees(f.billedPaise))").font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
                        }
                    }
                }
            }
        }
    }

    // MARK: Your day

    @ViewBuilder
    private var yourDay: some View {
        SectionLabel("Your day")
        LoadableView(today.state, retry: { Task { await reload() } }) { day in
            if day.entries.isEmpty {
                EmptyNote(text: "No classes scheduled today.", systemImage: "sun.max")
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(day.entries.prefix(8).enumerated()), id: \.element.id) { i, entry in
                        StaffPeriodRow(entry: entry, isLast: i == min(day.entries.count, 8) - 1)
                    }
                }
            }
        }
    }

    private func reload() async {
        async let a: () = dashboard.load { try await context.repo.dashboard() }
        async let b: () = today.load { try await context.repo.myDay(on: IST.todayOn()) }
        async let c: () = insight.load { try await context.repo.attendanceInsight(days: 14) }
        async let d: () = access.canSeeFees ? fees.load { try await context.repo.feesSummary() } : ()
        _ = await (a, b, c, d)
        await context.refreshPendingLeaves()
    }
}

/// "₹62,550" for small amounts, "₹1.5L" or "₹2.1Cr" for big ones, so a number never wraps in a narrow column.
func compactRupees(_ paise: Int) -> String {
    let rupees = Double(paise) / 100
    if rupees >= 1_00_00_000 { return String(format: "₹%.1fCr", rupees / 1_00_00_000) }
    if rupees >= 1_00_000 { return String(format: "₹%.1fL", rupees / 1_00_000) }
    return Money.format(paise: paise)
}

/// One period on the day's timeline: time on the left, a rail with a dot, then subject and class.
struct StaffPeriodRow: View {
    let entry: StaffDayEntry
    var isLast = false

    var body: some View {
        HStack(alignment: .top, spacing: Tokens.Space.s3) {
            Text(Text.clock(entry.slot.startsAt))
                .font(.sc(.caption, weight: .semibold)).foregroundStyle(Tokens.textSecondary).monospacedDigit()
                .frame(width: 62, alignment: .trailing).padding(.top, 3)
            VStack(spacing: 0) {
                Circle().fill(Tokens.accent).frame(width: 9, height: 9).padding(.top, 5)
                if !isLast { Rectangle().fill(Tokens.separator).frame(width: 1).frame(maxHeight: .infinity) }
            }
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: Tokens.Space.s2) {
                    Text(entry.slot.subjectName).font(.sc(.body, weight: .semibold))
                    if entry.substituteName != nil { Pill(text: "Cover", tone: .warning) }
                    else if entry.role == "substitute" { Pill(text: "Substitute", tone: .accent) }
                }
                Text("Class \(entry.slot.classLabel) · \(entry.slot.periodName)").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
            }
            .padding(.bottom, Tokens.Space.s4)
            Spacer(minLength: 0)
        }
    }
}
