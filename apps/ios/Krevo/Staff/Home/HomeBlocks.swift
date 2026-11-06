import SwiftUI
import Charts

// The cards on the staff Home. Each one loads its own small request, so a slow block never holds up the others.
// Which blocks appear, and in what order, comes from the server (`GET /home/layout`), based on the person's permissions.

/// Where a Home card can send you.
enum HomeRoute: Hashable {
    case students, leave, announcements, timetable
}

// MARK: My day

/// Today's periods as cards you swipe through, with a status chip on each (Now, Next, Done, Cover).
struct MyDayBlock: View {
    let go: (HomeRoute) -> Void
    /// Leave the block out on a day with no classes, for people whose Home has other work on it.
    var hideIfEmpty = false
    @Environment(StaffContext.self) private var context
    @State private var today = Loader<StaffDay>()

    var body: some View {
        if !(hideIfEmpty && today.state.value?.entries.isEmpty == true) { content } else { Color.clear.frame(height: 0).task { await load() } }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s3) {
            HStack {
                Text("Today's classes").font(.sc(.title3))
                Spacer()
                Button { go(.timetable) } label: {
                    HStack(spacing: 4) { Text("Timetable"); Image(systemName: "arrow.right") }
                        .font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.textSecondary)
                }.buttonStyle(.pressable)
            }
            LoadableView(today.state, retry: { Task { await load() } }) { day in
                if day.entries.isEmpty {
                    Text("No classes scheduled today.").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, Tokens.Space.s2)
                } else {
                    let now = IST.nowHM()
                    let entries = day.entries.sorted { $0.slot.startsAt < $1.slot.startsAt }
                    let nextId = entries.first { String($0.slot.startsAt.prefix(5)) > now }?.id
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: Tokens.Space.s3) {
                            ForEach(entries) { e in card(e, now: now, isNext: e.id == nextId) }
                        }
                    }
                    .scrollClipDisabled()
                }
            }
        }
        .task { await load() }
    }

    private func card(_ e: StaffDayEntry, now: String, isNext: Bool) -> some View {
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

    private func load() async { await today.load { try await context.repo.myDay(on: IST.todayOn()) } }
}

// MARK: My classes

/// The classes this person teaches, always shown. Tap one for its page; the student list and leave requests are one tap away.
struct MyClassesBlock: View {
    let go: (HomeRoute) -> Void
    @Environment(StaffContext.self) private var context

    private var mine: [(cls: StaffClass, role: String)] {
        var seen = Set<String>(), out: [(StaffClass, String)] = []
        for a in context.me.assignments {
            guard let cls = context.classes.first(where: { $0.id == a.classId }), seen.insert(cls.id + a.role).inserted else { continue }
            out.append((cls, a.role == "class_teacher" ? "Class teacher" : "Subject teacher"))
        }
        return out.sorted { ($0.0.grade, $0.0.section) < ($1.0.grade, $1.0.section) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("My classes").font(.sc(.title3)).padding(.bottom, Tokens.Space.s1)
            if mine.isEmpty {
                Text(context.classes.isEmpty ? "Loading your classes…" : "No classes assigned to you yet.")
                    .font(.sc(.callout)).foregroundStyle(Tokens.textSecondary).padding(.vertical, Tokens.Space.s3)
            } else {
                ForEach(Array(mine.enumerated()), id: \.offset) { i, item in
                    NavigationLink(value: item.cls) {
                        PlainRow(title: "Class \(item.cls.label)", subtitle: "\(item.role) · \(item.cls.students ?? 0) students", showsDivider: true) {
                            Text(item.cls.label).font(.sc(.title3)).foregroundStyle(Tokens.text).frame(width: 56, alignment: .leading)
                        }
                    }
                    .buttonStyle(.pressable)
                }
                Button { go(.students) } label: {
                    PlainRow(title: "My students", subtitle: "Everyone in your classes", showsDivider: context.access.canMarkAttendance && context.pendingLeaves > 0) {
                        Image(systemName: "person.2").font(.system(size: 18)).foregroundStyle(Tokens.text).frame(width: 56, alignment: .leading)
                    }
                }.buttonStyle(.pressable)
                if context.access.canMarkAttendance && context.pendingLeaves > 0 {
                    Button { go(.leave) } label: {
                        PlainRow(title: "\(context.pendingLeaves) leave \(context.pendingLeaves == 1 ? "request" : "requests") to decide", subtitle: "Parents are waiting for a reply", showsDivider: false) {
                            Image(systemName: "calendar.badge.exclamationmark").font(.system(size: 18)).foregroundStyle(Tokens.accent).frame(width: 56, alignment: .leading)
                        }
                    }.buttonStyle(.pressable)
                }
            }
        }
    }
}

// MARK: Notices

/// The latest announcements, for everyone.
struct NoticesBlock: View {
    let go: (HomeRoute) -> Void
    @Environment(StaffContext.self) private var context
    @State private var list = Loader<[Broadcast]>()

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Notices").font(.sc(.title3))
                Spacer()
                Button { go(.announcements) } label: {
                    HStack(spacing: 4) { Text("View all"); Image(systemName: "arrow.right") }
                        .font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.textSecondary)
                }.buttonStyle(.pressable)
            }
            .padding(.bottom, Tokens.Space.s1)
            LoadableView(list.state, retry: { Task { await load() } }) { rows in
                if rows.isEmpty {
                    Text("Nothing sent yet.").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary).padding(.vertical, Tokens.Space.s3)
                }
                let latest = Array(rows.prefix(3))
                ForEach(Array(latest.enumerated()), id: \.element.id) { i, b in
                    PlainLine(showsDivider: i < latest.count - 1) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(b.title).font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.text).lineLimit(1)
                            Text(b.body).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary).lineLimit(2)
                            Text("\(b.senderName) · \(IST.dateTime(b.createdAt))").font(.sc(.caption)).foregroundStyle(Tokens.textTertiary)
                        }
                    }
                }
            }
        }
        .task { await load() }
    }

    private func load() async { await list.load { try await context.repo.broadcasts() } }
}

// MARK: Academic

/// The school's attendance today and the numbers behind it. Only for people with the Academic permission.
struct AcademicBlock: View {
    let go: (StaffRootView.Tab) -> Void
    @Environment(StaffContext.self) private var context
    @State private var dashboard = Loader<StaffDashboard>()
    @State private var insight = Loader<AttendanceInsight>()
    @State private var overview = Loader<StaffDayOverview>()

    /// No attendance is taken on a Sunday or a holiday, so the card says so instead of "15 classes to mark".
    private var noSchool: String? {
        if let h = overview.state.value?.holiday { return h }
        return IST.weekdayIndex(IST.todayOn()) == 0 ? "Sunday" : nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s4) {
            LoadableView(dashboard.state, retry: { Task { await load() } }, skeleton: { SkeletonBlock(height: 250, radius: 32) }) { d in
                hero(d)
                glance(d)
            }
            trend
        }
        .task { await load() }
    }

    private func hero(_ d: StaffDashboard) -> some View {
        let a = d.attendance
        let unmarked = max(0, a.classesTotal - a.classesMarkedToday)
        let marked = a.classesTotal == 0 ? 0 : Double(a.classesMarkedToday) / Double(a.classesTotal)
        return VStack(alignment: .leading, spacing: Tokens.Space.s5) {
            VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                Text("Attendance today").font(.sc(.caption, weight: .semibold)).foregroundStyle(Tokens.accent).textCase(.uppercase)
                if let off = noSchool, a.classesMarkedToday == 0 {
                    Text("No school today").font(.sc(.title1)).foregroundStyle(Tokens.text)
                    Text(off).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                } else {
                    Text(unmarked == 0 ? "All marked" : "\(unmarked) \(unmarked == 1 ? "class" : "classes") to mark")
                        .font(.sc(.title1)).foregroundStyle(Tokens.text)
                    Text(a.todayPercentage.map { String(format: "%.0f%% present · ", $0) } ?? "")
                        .font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                    + Text("\(a.classesMarkedToday) of \(a.classesTotal) marked").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                }
            }
            if noSchool == nil || a.classesMarkedToday > 0 { BrandProgress(fraction: marked) }
            Button { go(.academic) } label: {
                HStack(spacing: 6) {
                    Text(unmarked > 0 && (noSchool == nil || a.classesMarkedToday > 0) ? "Open classes" : "View classes").font(.sc(.body, weight: .semibold))
                    Image(systemName: "arrow.up.right").font(.system(size: 13, weight: .bold))
                }
                .foregroundStyle(Tokens.onAccent)
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(Tokens.accent, in: Capsule())
            }.buttonStyle(.pressable)
        }
        .padding(Tokens.Space.s5)
        .frame(maxWidth: .infinity, alignment: .leading)
        // A flat, slightly grey card like the others: no border, no shadow. The orange dots and button stay.
        .background {
            ZStack(alignment: .topTrailing) {
                Tokens.card
                DotCorner(strength: 0.55, glow: false).frame(width: 230, height: 200)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 32, style: .continuous))
    }

    private func glance(_ d: StaffDashboard) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Tokens.Space.s3) {
                card("Students", "\(d.students)", "\(d.classes) \(d.classes == 1 ? "class" : "classes")")
                card("This month", percent(d.attendance.monthPercentage), "attendance")
                if let s = d.staff { card("Staff in", "\(s.presentToday)/\(s.activeStaff)", s.notMarkedToday > 0 ? "\(s.notMarkedToday) not marked" : "all marked") }
            }
        }
        .scrollClipDisabled()
    }

    private func card(_ label: String, _ value: String, _ hint: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
            Text(value).font(.sc(.title3)).foregroundStyle(Tokens.text).monospacedDigit().lineLimit(1)
            Text(hint).font(.sc(.caption)).foregroundStyle(Tokens.textTertiary).lineLimit(1)
        }
        .padding(Tokens.Space.s4)
        .frame(minWidth: 128, alignment: .leading)
        .background(Tokens.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    @ViewBuilder
    private var trend: some View {
        let points = (insight.state.value?.trend ?? []).compactMap { t in t.percentage.map { (id: t.dayOn, date: IST.pickerDate(on: t.dayOn), value: $0) } }
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
            .padding(Tokens.Space.s4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Tokens.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        }
    }

    private func load() async {
        async let a: () = dashboard.load { try await context.repo.dashboard() }
        async let b: () = insight.load { try await context.repo.attendanceInsight(days: 14) }
        async let c: () = overview.load { try await context.repo.dayOverview(day: IST.todayOn()) }
        _ = await (a, b, c)
    }
}

// MARK: Fees

/// Fee collection in one card. Only for people with the Fees permission.
struct FeesBlock: View {
    let go: (StaffRootView.Tab) -> Void
    @Environment(StaffContext.self) private var context
    @State private var fees = Loader<FeesSummary>()

    var body: some View {
        LoadableView(fees.state, retry: { Task { await load() } }, skeleton: { SkeletonBlock(height: 150, radius: 22) }) { f in
            if f.billedPaise > 0 {
                Button { go(.fees) } label: {
                    VStack(alignment: .leading, spacing: Tokens.Space.s3) {
                        HStack {
                            Text("Fees").font(.sc(.title3)).foregroundStyle(Tokens.text)
                            Spacer()
                            Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Tokens.textTertiary)
                        }
                        Text(rupees(f.collectedPaise)).font(.sc(.title1)).foregroundStyle(Tokens.text)
                        BrandProgress(fraction: (f.collectionPercentage ?? 0) / 100)
                        HStack {
                            Text("of \(rupees(f.billedPaise)) billed").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                            Spacer()
                            if f.overduePaise > 0 {
                                Text("\(rupees(f.overduePaise)) overdue").font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.danger)
                            }
                        }
                    }
                    .padding(Tokens.Space.s4)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Tokens.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                }.buttonStyle(.pressable)
            }
        }
        .task { await load() }
    }

    private func load() async { await fees.load { try await context.repo.feesSummary() } }
}

// MARK: Library

/// Books out and overdue, in one card. Only for people with the Library permission.
struct LibraryBlock: View {
    let go: (StaffRootView.Tab) -> Void
    @Environment(StaffContext.self) private var context
    @State private var summary = Loader<LibrarySummary>()

    var body: some View {
        LoadableView(summary.state, retry: { Task { await load() } }, skeleton: { SkeletonBlock(height: 120, radius: 22) }) { s in
            Button { go(.library) } label: {
                VStack(alignment: .leading, spacing: Tokens.Space.s3) {
                    HStack {
                        Text("Library").font(.sc(.title3)).foregroundStyle(Tokens.text)
                        Spacer()
                        Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Tokens.textTertiary)
                    }
                    HStack(alignment: .top, spacing: 0) {
                        stat("Books", "\(s.books)")
                        stat("On loan", "\(s.onLoan)")
                        stat("Overdue", "\(s.overdue)", tone: s.overdue > 0 ? Tokens.danger : Tokens.text)
                    }
                }
                .padding(Tokens.Space.s4)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Tokens.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            }.buttonStyle(.pressable)
        }
        .task { await load() }
    }

    private func stat(_ label: String, _ value: String, tone: Color = Tokens.text) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
            Text(value).font(.sc(.title3)).foregroundStyle(tone).monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func load() async { await summary.load { try await context.repo.librarySummary() } }
}

// MARK: People

/// Who is on staff and how many logins are still to be sent. Only for people who manage people and access.
struct PeopleBlock: View {
    let open: () -> Void
    @Environment(StaffContext.self) private var context
    @State private var staff = Loader<[StaffMember]>()

    var body: some View {
        LoadableView(staff.state, retry: { Task { await load() } }, skeleton: { SkeletonBlock(height: 96, radius: 22) }) { list in
            Button(action: open) {
                VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                    HStack {
                        Text("People & access").font(.sc(.title3)).foregroundStyle(Tokens.text)
                        Spacer()
                        Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Tokens.textTertiary)
                    }
                    let waiting = list.filter { ($0.inviteStatus ?? "") != "active" && $0.isActive }.count
                    Text("\(list.count) staff" + (waiting > 0 ? " · \(waiting) not signed in yet" : "")).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                }
                .padding(Tokens.Space.s4)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Tokens.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            }.buttonStyle(.pressable)
        }
        .task { await load() }
    }

    private func load() async { await staff.load { try await context.repo.staff(query: "") } }
}
