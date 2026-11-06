import SwiftUI
import Charts

// The cards on the staff Home. Each one loads its own small request, so a slow block never holds up the others.
// Which blocks appear, and in what order, comes from the server (`GET /home/layout`), based on the person's permissions.

/// Where a Home card can send you.
enum HomeRoute: Hashable {
    case students, leave, announcements, timetable, people
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
        if !(hideIfEmpty && today.state.value?.entries.isEmpty == true) { content } else { Color.clear.frame(height: 0).padding(.vertical, -Tokens.Space.s2).task { await load() } }
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
        list
    }

    private var list: some View {
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

/// The attendance-to-mark card at the top of Home, on a liquid-glass card. A class teacher sees their own classes: how many
/// still need marking today, and a button for each. Someone with full access (who can mark any class) sees the whole school:
/// how many classes still need marking, and one button that opens the Classes page. Says so on a Sunday or a holiday, and
/// stays out of the way for anyone who cannot mark attendance.
struct MyAttendanceCard: View {
    /// Opens the Classes page (the Academic tab), for the school-wide version.
    let openClasses: () -> Void
    @Environment(StaffContext.self) private var context
    @State private var overview = Loader<StaffDayOverview>()

    private var ownClasses: [StaffClass] {
        let ids = Set(context.me.assignments.filter { $0.role == "class_teacher" }.map(\.classId))
        return context.classes.filter { ids.contains($0.id) }
    }
    /// Not a class teacher, but may mark every class.
    private var schoolWide: Bool { ownClasses.isEmpty && context.access.isAdmin && !context.classes.isEmpty }
    private var classes: [StaffClass] { schoolWide ? context.classes : ownClasses }

    var body: some View {
        if !classes.isEmpty {
            card.task { await overview.load { try await context.repo.dayOverview(day: IST.todayOn()) } }
        }
    }

    /// Compact, so it can share a row with the Notices card: a label, the count, and one button.
    private var card: some View {
        let day = IST.todayOn()
        let marked = Set((overview.state.value?.classes ?? []).filter(\.marked).map(\.classId))
        let todo = classes.filter { !marked.contains($0.id) }
        let off = overview.state.value?.holiday ?? (IST.weekdayIndex(day) == 0 ? "Sunday" : nil)
        return VStack(alignment: .leading, spacing: 4) {
            Text(schoolWide ? "Attendance" : "My attendance").font(.sc(.caption, weight: .semibold)).foregroundStyle(Tokens.accent)
                .textCase(.uppercase).lineLimit(1).minimumScaleFactor(0.8)
            if overview.state.value == nil {
                SkeletonLine(width: 100, role: .title2)
            } else if let off, marked.isEmpty {
                headline("No school"); note(off)
            } else if todo.isEmpty {
                headline("All marked"); note("\(classes.count) \(classes.count == 1 ? "class" : "classes") done")
            } else if schoolWide {
                headline("\(todo.count) of \(classes.count)"); note("classes to mark")
            } else {
                headline("\(todo.count) to mark"); note(todo.count == 1 ? "Class \(todo[0].label)" : "Class \(todo[0].label) and more")
            }
            Spacer(minLength: 4)
            if overview.state.value != nil, !todo.isEmpty, off == nil || !marked.isEmpty {
                if schoolWide {
                    Button(action: openClasses) { markLabel("Mark") }.buttonStyle(.pressable)
                } else {
                    NavigationLink(value: AttendanceTarget(cls: todo[0], day: day)) { markLabel("Mark") }.buttonStyle(.pressable)
                }
            }
        }
        .padding(Tokens.Space.s4)
        .frame(maxWidth: .infinity, minHeight: 210, maxHeight: 210, alignment: .topLeading)
        .chromeSurface(in: RoundedRectangle(cornerRadius: 28, style: .continuous))
    }

    private func headline(_ text: String) -> some View {
        Text(text).font(.sc(.title2)).foregroundStyle(Tokens.text).lineLimit(1).minimumScaleFactor(0.6)
    }

    private func note(_ text: String) -> some View {
        Text(text).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary).lineLimit(2).minimumScaleFactor(0.8)
    }

    private func markLabel(_ title: String) -> some View {
        HStack(spacing: 6) {
            Text(title).font(.sc(.body, weight: .semibold))
            Image(systemName: "arrow.up.right").font(.system(size: 13, weight: .bold))
        }
        .foregroundStyle(Tokens.onAccent)
        .frame(maxWidth: .infinity, minHeight: 46)
        .background(Tokens.accent, in: Capsule())
    }
}

// MARK: Top row

/// Attendance to mark and the latest notice side by side, the same height: compact and clean. Without an attendance card
/// (someone who cannot mark attendance) the notice takes the whole row.
struct TopRowBlock: View {
    let showsAttendance: Bool
    let openClasses: () -> Void
    let go: (HomeRoute) -> Void

    var body: some View {
        HStack(alignment: .top, spacing: Tokens.Space.s3) {
            if showsAttendance { MyAttendanceCard(openClasses: openClasses) }
            NoticesBlock(go: go)
        }
    }
}

// MARK: Notices

/// The latest notice as a card: its photo fills the card, with a dark shadow at the bottom and the notice's text inside it.
/// With no photo the school's logo shows; with no logo, an orange gradient carries the school's name. The whole card opens
/// the Notices page (every notice, a page at a time).
struct NoticesBlock: View {
    let go: (HomeRoute) -> Void
    @Environment(StaffContext.self) private var context
    @State private var list = Loader<[Broadcast]>()
    @State private var photo: URL?

    private var latest: Broadcast? { list.state.value?.first }
    private var photoId: String? { latest?.attachments?.first(where: { $0.contentType.hasPrefix("image/") })?.id }
    private var school: StaffSchool? { context.me.school }

    var body: some View {
        Button { go(.announcements) } label: {
            ZStack(alignment: .bottomLeading) {
                background
                // The shadow that makes the white text readable on any picture.
                LinearGradient(colors: [.clear, .black.opacity(0.35), .black.opacity(0.78)], startPoint: .init(x: 0.5, y: 0.42), endPoint: .bottom)
                VStack(alignment: .leading, spacing: 3) {
                    if let b = latest {
                        Text(b.title).font(.sc(.body, weight: .semibold)).foregroundStyle(.white).lineLimit(2).multilineTextAlignment(.leading)
                        Text(b.body).font(.sc(.caption)).foregroundStyle(.white.opacity(0.85)).lineLimit(1)
                        Text(IST.dateTime(b.createdAt)).font(.sc(.caption)).foregroundStyle(.white.opacity(0.65)).lineLimit(1)
                    } else {
                        Text(list.state.value == nil ? " " : "Nothing sent yet.").font(.sc(.callout)).foregroundStyle(.white.opacity(0.85))
                    }
                }
                .padding(Tokens.Space.s4)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .overlay(alignment: .topLeading) {
                Text("Notices").font(.sc(.caption, weight: .semibold)).foregroundStyle(Tokens.text)
                    .padding(.horizontal, 12).frame(minHeight: 28)
                    .background(.white.opacity(0.92), in: Capsule())
                    .padding(Tokens.Space.s3)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 210)
            .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        }
        .buttonStyle(.pressable)
        .task { await load() }
        .task(id: photoId) {
            guard let id = photoId else { photo = nil; return }
            photo = try? await context.chat.attachmentURL(id: id)
        }
    }

    /// The notice's photo; else the school's logo; else an orange gradient with the school's name.
    @ViewBuilder
    private var background: some View {
        if photoId != nil {
            ZStack {
                orange
                if let photo {
                    AsyncImage(url: photo) { phase in
                        if case .success(let image) = phase { image.resizable().scaledToFill() }
                    }
                }
            }
        } else if let logo = school?.logoUrl, let url = URL(string: logo) {
            ZStack {
                Tokens.card
                AsyncImage(url: url) { phase in
                    if case .success(let image) = phase { image.resizable().scaledToFit().padding(.horizontal, 40).padding(.top, 44).padding(.bottom, 80) }
                }
            }
        } else {
            orange.overlay(alignment: .topLeading) {
                Text(school?.name ?? "Krevo").font(.sc(.title3)).foregroundStyle(.white)
                    .multilineTextAlignment(.leading).minimumScaleFactor(0.6).lineLimit(3)
                    .padding(.horizontal, Tokens.Space.s4).padding(.top, 52).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private var orange: some View {
        LinearGradient(colors: [Tokens.accent, Color(red: 1.0, green: 0.55, blue: 0.22)], startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    private func load() async { await list.load { try await context.repo.broadcasts() } }
}

// MARK: Academic

/// What the two Academic blocks (the attendance card and the numbers under it) both read, loaded once.
@Observable
@MainActor
final class AcademicModel {
    let dashboard = Loader<StaffDashboard>()
    let insight = Loader<AttendanceInsight>()
    let overview = Loader<StaffDayOverview>()

    func load(_ repo: any StaffRepository) async {
        async let a: () = dashboard.load { try await repo.dashboard() }
        async let b: () = insight.load { try await repo.attendanceInsight(days: 14) }
        async let c: () = overview.load { try await repo.dayOverview(day: IST.todayOn()) }
        _ = await (a, b, c)
    }
}

/// The Academic bento: one outlined container with small blocks inside. The numbers (students, this month, staff in) run
/// across the top and the 14-day attendance line is the block below them. Only for people with the Academic permission.
/// The attendance block opens the Academic tab.
struct AcademicBentoBlock: View {
    let model: AcademicModel
    let go: (StaffRootView.Tab) -> Void

    var body: some View {
        VStack(spacing: Tokens.Space.s2) {
            LoadableView(model.dashboard.state, retry: {}, skeleton: { SkeletonBlock(height: 220, radius: 22) }) { d in
                statsRow(d)
                attendanceTile
            }
        }
        .padding(Tokens.Space.s2)
        // Flat: a grey container, no border, no glass. The blocks inside are white.
        .background(Tokens.card, in: RoundedRectangle(cornerRadius: 30, style: .continuous))
    }

    // MARK: Numbers across the top

    private func statsRow(_ d: StaffDashboard) -> some View {
        HStack(spacing: Tokens.Space.s2) {
            stat("Students", "\(d.students)", "\(d.classes) \(d.classes == 1 ? "class" : "classes")")
            stat("This month", percent(d.attendance.monthPercentage), "attendance")
            if let s = d.staff { stat("Staff in", "\(s.presentToday)/\(s.activeStaff)", s.notMarkedToday > 0 ? "\(s.notMarkedToday) not marked" : "all marked") }
        }
    }

    private func stat(_ label: String, _ value: String, _ hint: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary).lineLimit(1)
            Text(value).font(.sc(.title3)).foregroundStyle(Tokens.text).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
            Text(hint).font(.sc(.caption)).foregroundStyle(Tokens.textTertiary).lineLimit(1).minimumScaleFactor(0.7)
        }
        .padding(Tokens.Space.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Tokens.bg, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    // MARK: Attendance line below

    private var attendanceTile: some View {
        let points = (model.insight.state.value?.trend ?? []).compactMap { t in t.percentage.map { (id: t.dayOn, date: IST.pickerDate(on: t.dayOn), value: $0) } }
        return Button { go(.academic) } label: {
            VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                HStack {
                    Text("Attendance, 14 days").font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.text)
                    Spacer()
                    if let overall = model.insight.state.value?.overallPercentage {
                        Text(String(format: "%.1f%%", overall)).font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.text).monospacedDigit()
                    }
                }
                if points.count > 1 {
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
                    .frame(height: 64)
                    .accessibilityLabel("Attendance over the last 14 days")
                } else {
                    Text("Not enough marked days yet.").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                }
            }
            .padding(Tokens.Space.s4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Tokens.bg, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        }
        .buttonStyle(.pressable)
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
