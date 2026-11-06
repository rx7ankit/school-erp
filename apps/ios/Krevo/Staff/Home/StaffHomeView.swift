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
            ScreenScroll {
                header

                LoadableView(dashboard.state, retry: { Task { await reload() } }, skeleton: {
                    SkeletonBlock(height: 250, radius: 32)
                }) { d in
                    hero(d)
                    glance(d)
                    attention(d)
                }

                classesRow
                pulse
            }
            .refreshable { await reload() }
            .toolbar(.hidden, for: .navigationBar)
            .task { await reload() }
        }
    }

    /// Greeting on the left, the person's initials on the right (tap for their profile), and a quiet line of chips.
    private var header: some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s3) {
            HStack(alignment: .center) {
                TwoToneTitle(ink: "Hi,", grey: firstName, role: .title1)
                Button { go(.more) } label: {
                    Text(initials).font(.sc(.callout, weight: .bold)).foregroundStyle(Tokens.onSolid)
                        .frame(width: 44, height: 44).background(Tokens.solid, in: Circle())
                }
                .buttonStyle(.pressable)
                .accessibilityLabel("Your profile")
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Tokens.Space.s2) {
                    chip(access.roleTitle, strong: true)
                    if let school = context.me.school { chip(school.name) }
                    chip(IST.date(IST.todayOn()))
                }
            }
        }
    }

    private var initials: String {
        context.me.name.split(separator: " ").prefix(2).compactMap { $0.first }.map(String.init).joined().uppercased()
    }

    private func chip(_ text: String, strong: Bool = false) -> some View {
        Text(text).font(.sc(.caption, weight: .semibold))
            .foregroundStyle(strong ? Tokens.onSolid : Tokens.textSecondary)
            .padding(.horizontal, 12).frame(minHeight: 30)
            .background(strong ? Tokens.solid : Tokens.card, in: Capsule())
    }

    // MARK: Today

    /// The solid black hero: the one thing to know first, and two big buttons, like a balance card with Send and Receive.
    /// Admin and class teachers: attendance. A subject teacher: the next class. Orange dots glow in the corner.
    private func hero(_ d: StaffDashboard) -> some View {
        let a = d.attendance
        let unmarked = max(0, a.classesTotal - a.classesMarkedToday)
        let marked = a.classesTotal == 0 ? 0 : Double(a.classesMarkedToday) / Double(a.classesTotal)
        return VStack(alignment: .leading, spacing: Tokens.Space.s5) {
            if access.canMarkAttendance {
                VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                    heroLabel(access.isAdmin ? "Attendance today" : "Your class today")
                    Text(unmarked == 0 ? "All marked" : "\(unmarked) \(unmarked == 1 ? "class" : "classes") to mark")
                        .font(.sc(.title1)).foregroundStyle(Tokens.text)
                    Text(a.todayPercentage.map { String(format: "%.0f%% present · ", $0) } ?? "")
                        .font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                    + Text("\(a.classesMarkedToday) of \(a.classesTotal) marked").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                }
                BrandProgress(fraction: marked, track: Tokens.fill)
            } else {
                nextClass
            }
            // One clear action. The rest (leave, students) is a tap away in the tab bar and the list below.
            if access.canMarkAttendance {
                heroButton(unmarked > 0 ? "Mark attendance" : "View attendance", "arrow.up.right") { go(.attendance) }
            } else {
                heroButton("Open students", "arrow.up.right") { go(.students) }
            }
        }
        .padding(Tokens.Space.s5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            ZStack(alignment: .topTrailing) {
                // A frosted, almost white card: a gentle top-left to bottom-right fade, with orange light coming in from the right.
                LinearGradient(colors: [.white, Color(light: 0xF1F1F5)], startPoint: .topLeading, endPoint: .bottomTrailing)
                Spotlight(strength: 0.9).frame(width: 320, height: 300)
                DotCorner(strength: 0.8).frame(width: 230, height: 200)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 32, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 32, style: .continuous).stroke(.white, lineWidth: 1.5))
        .overlay(RoundedRectangle(cornerRadius: 32, style: .continuous).stroke(Tokens.separator.opacity(0.7), lineWidth: 0.5))
        .shadow(color: .black.opacity(0.07), radius: 22, x: 0, y: 10)
    }

    private func heroButton(_ title: String, _ icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Text(title).font(.sc(.body, weight: .semibold))
                Image(systemName: icon).font(.system(size: 13, weight: .bold))
            }
            .foregroundStyle(Tokens.onAccent)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(Tokens.accent, in: Capsule())
        }
        .buttonStyle(.pressable)
    }

    /// Small numbers, side by side, that scroll sideways. Fees and staff figures only for people allowed to see them.
    private func glance(_ d: StaffDashboard) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Tokens.Space.s3) {
                glanceCard("Students", "\(d.students)", hint: "\(d.classes) \(d.classes == 1 ? "class" : "classes")")
                glanceCard("This month", percent(d.attendance.monthPercentage), hint: "attendance")
                if access.canSeeStaff, let s = d.staff { glanceCard("Staff in", "\(s.presentToday)/\(s.activeStaff)", hint: s.notMarkedToday > 0 ? "\(s.notMarkedToday) not marked" : "all marked") }
                if access.canSeeFees, let f = d.fees { glanceCard("Collected", compactRupees(f.collectedThisMonthPaise), hint: "this month") }
            }
        }
        .scrollClipDisabled()
    }

    private func glanceCard(_ label: String, _ value: String, hint: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
            Text(value).font(.sc(.title3)).foregroundStyle(Tokens.text).monospacedDigit().lineLimit(1)
            Text(hint).font(.sc(.caption)).foregroundStyle(Tokens.textTertiary).lineLimit(1)
        }
        .padding(Tokens.Space.s4)
        .frame(minWidth: 128, alignment: .leading)
        .background(Tokens.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
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
                    Text(e.slot.subjectName).font(.sc(.title1)).foregroundStyle(Tokens.text)
                    Text("Class \(e.slot.classLabel) · \(Text.clock(e.slot.startsAt))").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                } else {
                    Text(day.entries.isEmpty ? "No classes today" : "Done for today").font(.sc(.title1)).foregroundStyle(Tokens.text)
                    Text(day.entries.isEmpty ? "Enjoy the day off." : "\(day.entries.count) \(day.entries.count == 1 ? "class" : "classes") taught.").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
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

    // MARK: Today's classes

    /// The day's periods as cards you swipe through, each with its time and a status chip (Now, Next, Done).
    @ViewBuilder
    private var classesRow: some View {
        HStack {
            Text("Today's classes").font(.sc(.title3))
            Spacer()
            Button { go(.more) } label: {
                HStack(spacing: 4) { Text("View all"); Image(systemName: "arrow.right") }
                    .font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.textSecondary)
            }.buttonStyle(.pressable)
        }
        .padding(.top, Tokens.Space.s2)
        LoadableView(today.state, retry: { Task { await reload() } }) { day in
            if day.entries.isEmpty {
                EmptyNote(text: "No classes scheduled today.", systemImage: "sun.max")
            } else {
                let now = IST.nowHM()
                let entries = day.entries.sorted { $0.slot.startsAt < $1.slot.startsAt }
                let nextId = entries.first { String($0.slot.startsAt.prefix(5)) > now }?.id
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Tokens.Space.s3) {
                        ForEach(entries) { e in classCard(e, now: now, isNext: e.id == nextId) }
                    }
                }
                .scrollClipDisabled()
            }
        }
    }

    private func classCard(_ e: StaffDayEntry, now: String, isNext: Bool) -> some View {
        let start = String(e.slot.startsAt.prefix(5)), end = String(e.slot.endsAt.prefix(5))
        let isNow = start <= now && now < end
        let done = end <= now
        return VStack(alignment: .leading, spacing: Tokens.Space.s3) {
            HStack {
                Text(Text.clock(e.slot.startsAt)).font(.sc(.caption, weight: .semibold)).foregroundStyle(Tokens.textSecondary)
                    .padding(.horizontal, 10).frame(minHeight: 26).background(Tokens.fill, in: Capsule())
                Spacer(minLength: Tokens.Space.s2)
                if e.substituteName != nil { Pill(text: "Cover", tone: .warning) }
                else if isNow { Pill(text: "Now", tone: .success) }
                else if isNext { Pill(text: "Next", tone: .warning) }
                else if done { Pill(text: "Done") }
            }
            Text(e.slot.subjectName).font(.sc(.title3)).foregroundStyle(done ? Tokens.textSecondary : Tokens.text).lineLimit(1)
            Separator()
            Text("Class \(e.slot.classLabel)").font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.text)
            Text(e.slot.periodName).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
        }
        .padding(Tokens.Space.s4)
        .frame(width: 210, alignment: .leading)
        .background(Tokens.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(isNow ? Tokens.accent : .clear, lineWidth: 1.5))
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
