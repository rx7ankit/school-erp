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

private struct BlackGlass: ViewModifier {
    func body(content: Content) -> some View {
        content.glassCapsule(tint: .black.opacity(0.85), fallback: .black)
    }
}

struct MyAttendanceCard: View {
    @Environment(StaffContext.self) private var context
    @State private var overview = Loader<StaffDayOverview>()

    private var classes: [StaffClass] {
        #if DEBUG
        if StaffAccess.isPreviewing { return Array(context.classes.prefix(StaffAccess.previewClassCount)) }
        #endif
        let ids = Set(context.me.assignments.filter { $0.role == "class_teacher" }.map(\.classId))
        return context.classes.filter { ids.contains($0.id) }
    }

    var body: some View {
        if !classes.isEmpty {
            card
                .task { await overview.load { try await context.repo.dayOverview(day: IST.todayOn()) } }
        }
    }

    private var card: some View {
        let day = IST.todayOn()
        let days = Dictionary(uniqueKeysWithValues: (overview.state.value?.classes ?? []).map { ($0.classId, $0) })
        let markedCount = classes.filter { days[$0.id]?.marked == true }.count
        let off = overview.state.value?.holiday ?? (IST.weekdayIndex(day) == 0 ? "Sunday" : nil)
        return VStack(alignment: .leading, spacing: Tokens.Space.s3) {
            if classes.count > 1 {
                Text("Attendance today").font(.sc(.caption, weight: .semibold)).foregroundStyle(Tokens.accent).textCase(.uppercase)
            }
            if overview.state.value == nil {
                SkeletonLine(width: 160, role: .title2)
            } else if let off, markedCount == 0 {
                Text("No school today").font(.sc(.title2)).foregroundStyle(Tokens.text)
                Text(off).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
            } else if classes.count == 1 {
                single(classes[0], day: days[classes[0].id], on: day)
            } else {
                Text("\(markedCount) of \(classes.count) marked").font(.sc(.title2)).foregroundStyle(Tokens.text)
                ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Tokens.Space.s2) {
                    ForEach(classes) { cls in
                        let done = days[cls.id]?.marked == true
                        NavigationLink(value: AttendanceTarget(cls: cls, day: day)) {
                            Text(done ? "\(cls.label) ✓" : "\(cls.label) · Mark")
                                .font(.sc(.callout, weight: .semibold))
                                .foregroundStyle(done ? Tokens.text : .white)
                                .padding(.horizontal, 16).frame(minHeight: 40)
                                .glassCapsule(tint: done ? Color.gray.opacity(0.22) : Tokens.accent, fallback: done ? Tokens.text.opacity(0.08) : Tokens.accent)
                        }
                        .buttonStyle(.pressable)
                    }
                }
                }
                .horizontalEdgeFade()
            }
        }
        // Less on the right than the left, so the Mark button sits the same distance from the right edge as from the top and bottom.
        .padding(.leading, Tokens.Space.s4).padding(.trailing, 9).padding(.vertical, Tokens.Space.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .chromeSurface(in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    private func single(_ cls: StaffClass, day: StaffClassDay?, on date: String) -> some View {
        let marked = day?.marked == true
        return HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 1) {
                Text("Class \(cls.label) · today").font(.sc(.caption, weight: .semibold)).foregroundStyle(Tokens.accent).textCase(.uppercase)
                Text(marked ? (day?.percentage.map { "\(Int($0.rounded()))% present" } ?? "Marked") : "Not marked")
                    .font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.text).lineLimit(1).minimumScaleFactor(0.7)
            }
            Spacer(minLength: Tokens.Space.s3)
            NavigationLink(value: AttendanceTarget(cls: cls, day: date)) { markLabel(marked ? "View" : "Mark") }
                .buttonStyle(.pressable)
        }
    }

    /// A medium button: black liquid glass (a black capsule before iOS 26) with white text.
    private func markLabel(_ title: String) -> some View {
        HStack(spacing: 6) {
            Text(title).font(.sc(.callout, weight: .semibold)).lineLimit(1)
            Image(systemName: "arrow.up.right").font(.system(size: 12, weight: .bold))
        }
        .fixedSize()
        .foregroundStyle(.white)
        .padding(.horizontal, 16).frame(minHeight: 38)
        .modifier(BlackGlass())
    }
}

// MARK: Notices

/// The latest five notices as a swipeable row of small bento cards (about 60% of the width), so the next notice shows beside the first. "Notices" and "View all" sit on a row
/// above. A whole card opens that notice; the arrow at its bottom right says so.
struct NoticesBlock: View {
    let go: (HomeRoute) -> Void
    let open: (Broadcast) -> Void
    @Environment(StaffContext.self) private var context
    @Environment(NoticeReads.self) private var reads
    @State private var list = Loader<[Broadcast]>()
    private var latest: [Broadcast] { Array((list.state.value ?? []).prefix(5)) }

    var body: some View {
        // The block breaks out of the page's 20pt side padding, so the row of cards runs to both screen edges; the heading
        // and the first card keep the page margin.
        VStack(alignment: .leading, spacing: Tokens.Space.s2) {
            HStack {
                Text("Notices").font(.sc(.title3)).foregroundStyle(Tokens.text)
                Spacer()
                Button { go(.announcements) } label: {
                    Text("View all").font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.accent)
                        .frame(minHeight: 30, alignment: .trailing)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 20)
            if latest.isEmpty {
                Text(list.state.value == nil ? " " : "Nothing sent yet.").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                    .frame(maxWidth: .infinity, minHeight: 150, alignment: .center)
                    .background(Tokens.card, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
                    .padding(.horizontal, 20)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Tokens.Space.s3) {
                        ForEach(latest) { b in card(b).containerRelativeFrame(.horizontal) { w, _ in w * 0.55 } }
                    }
                    .scrollTargetLayout()
                }
                .scrollTargetBehavior(.viewAligned)
                .contentMargins(.horizontal, 20, for: .scrollContent)
            }
        }
        .padding(.horizontal, -20)
        .task(id: reads.changes) { await list.load { try await context.repo.broadcasts() } }
    }

    private func card(_ b: Broadcast) -> some View {
        Button { open(b) } label: { NoticeCard(notice: b) }
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
