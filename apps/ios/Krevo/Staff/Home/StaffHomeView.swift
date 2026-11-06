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
                    hero(d)
                    attention(d)
                }

                // A teacher's own timetable matters most to them; admins look at the school first.
                if !access.isAdmin { yourDay }
                pulse
                if access.isAdmin { yourDay }
            }
            .refreshable { await reload() }
            .toolbar(.hidden, for: .navigationBar)
            .task { await reload() }
        }
    }

    // MARK: Today

    /// The solid black hero: the one thing this person should do or know first, then a few small numbers.
    /// Admin and class teachers: attendance. A subject teacher: the next class. Fees and staff numbers only if allowed.
    private func hero(_ d: StaffDashboard) -> some View {
        let a = d.attendance
        let unmarked = max(0, a.classesTotal - a.classesMarkedToday)
        let marked = a.classesTotal == 0 ? 0 : Double(a.classesMarkedToday) / Double(a.classesTotal)
        return VStack(alignment: .leading, spacing: Tokens.Space.s4) {
            if access.canMarkAttendance {
                VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                    heroLabel(access.isAdmin ? "Attendance today" : "Your class today")
                    Text(unmarked == 0 ? "All marked" : "\(unmarked) \(unmarked == 1 ? "class" : "classes") to mark")
                        .font(.sc(.title1)).foregroundStyle(Tokens.onSolid)
                    Text(a.todayPercentage.map { String(format: "%.0f%% present · ", $0) } ?? "")
                        .font(.sc(.callout)).foregroundStyle(.white.opacity(0.6))
                    + Text("\(a.classesMarkedToday) of \(a.classesTotal) marked").font(.sc(.callout)).foregroundStyle(.white.opacity(0.6))
                }
                BrandProgress(fraction: marked, track: .white.opacity(0.16))
                if unmarked > 0 {
                    Button { go(.attendance) } label: {
                        Text("Mark attendance").font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.onAccent)
                            .frame(maxWidth: .infinity, minHeight: Tokens.Control.md)
                            .background(Tokens.accent, in: Capsule())
                    }.buttonStyle(.pressable)
                }
            } else {
                nextClass
            }
            Rectangle().fill(.white.opacity(0.12)).frame(height: 0.5)
            HStack(alignment: .top, spacing: 0) {
                heroStat("Students", "\(d.students)")
                if access.canSeeStaff, let s = d.staff { heroStat("Staff in", "\(s.presentToday)/\(s.activeStaff)") }
                if access.canSeeFees, let f = d.fees { heroStat("Collected", compactRupees(f.collectedThisMonthPaise), hint: "this month") }
                if !access.canSeeStaff, !access.canSeeFees { heroStat("This month", percent(a.monthPercentage), hint: "attendance") }
            }
        }
        .padding(Tokens.Space.s5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Tokens.solid, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
    }

    private func heroLabel(_ text: String) -> some View {
        Text(text).font(.sc(.caption, weight: .semibold)).foregroundStyle(Tokens.accent).textCase(.uppercase)
    }

    private func heroStat(_ label: String, _ value: String, hint: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.sc(.caption)).foregroundStyle(.white.opacity(0.6))
            Text(value).font(.sc(.title3)).foregroundStyle(Tokens.onSolid).monospacedDigit().minimumScaleFactor(0.7).lineLimit(1)
            if let hint { Text(hint).font(.sc(.caption)).foregroundStyle(.white.opacity(0.45)) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// For a subject teacher: the next period today, or a calm "done for today".
    @ViewBuilder
    private var nextClass: some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s2) {
            heroLabel("Next class")
            if let day = today.state.value {
                let now = IST.nowHM()
                let upcoming = day.entries.sorted { $0.slot.startsAt < $1.slot.startsAt }.first { String($0.slot.endsAt.prefix(5)) > now }
                if let e = upcoming {
                    Text(e.slot.subjectName).font(.sc(.title1)).foregroundStyle(Tokens.onSolid)
                    Text("Class \(e.slot.classLabel) · \(Text.clock(e.slot.startsAt))").font(.sc(.callout)).foregroundStyle(.white.opacity(0.6))
                } else {
                    Text(day.entries.isEmpty ? "No classes today" : "Done for today").font(.sc(.title1)).foregroundStyle(Tokens.onSolid)
                    Text(day.entries.isEmpty ? "Enjoy the day off." : "\(day.entries.count) \(day.entries.count == 1 ? "class" : "classes") taught.").font(.sc(.callout)).foregroundStyle(.white.opacity(0.6))
                }
            } else {
                SkeletonLine(width: 140, role: .title1)
            }
        }
    }

    /// Things waiting on a decision. Rows only appear when there is something to do and the person is allowed to act on it.
    @ViewBuilder
    private func attention(_ d: StaffDashboard) -> some View {
        let showLeave = access.canMarkAttendance && context.pendingLeaves > 0
        let overdue = access.canSeeFees ? (d.fees?.overduePaise ?? 0) : 0
        if showLeave || overdue > 0 {
            ListCard {
                if showLeave {
                    ListRow(icon: "calendar.badge.exclamationmark", tint: Tokens.accent,
                            title: "\(context.pendingLeaves) leave \(context.pendingLeaves == 1 ? "request" : "requests") to decide",
                            subtitle: "Parents are waiting for a reply", showsDivider: overdue > 0) { go(.leave) }
                }
                if overdue > 0, let f = d.fees {
                    ListRow(icon: "indianrupeesign.circle", tint: Tokens.accent, title: "\(rupees(overdue)) overdue",
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
            SectionLabel(access.isAdmin || access.canSeeFees ? "School this month" : "Attendance")
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
