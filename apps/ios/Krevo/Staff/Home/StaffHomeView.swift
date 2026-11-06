import SwiftUI

/// The staff Home: a stack of blocks. Which blocks, and in what order, is decided by the server from the person's
/// permissions (`GET /home/layout`). Everyone gets My day, My classes and Notices; Academic, Fees and
/// People & access appear only for whoever holds that permission.
struct StaffHomeView: View {
    let go: (StaffRootView.Tab) -> Void

    @Environment(StaffContext.self) private var context
    @State private var showProfile = false
    @State private var path = NavigationPath()
    @State private var refreshToken = 0

    var body: some View {
        NavigationStack(path: $path) {
            ScreenScroll {
                header
                ForEach(blocks, id: \.self) { block($0) }
                    .id(refreshToken)
            }
            .refreshable {
                await context.loadLayout()
                await context.refreshPendingLeaves()
                await context.refreshMe()
                refreshToken += 1
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: HomeRoute.self) { route in
                switch route {
                case .students: StaffStudentsView(embedded: true).hidesTabBar()
                case .leave: StaffLeaveView(embedded: true).hidesTabBar()
                case .announcements: StaffAnnouncementsView().hidesTabBar()
                case .timetable: StaffTimetableView().hidesTabBar()
                case .people: StaffPeopleView().hidesTabBar()
                }
            }
            .navigationDestination(for: Broadcast.self) { StaffNoticeDetailView(notice: $0).hidesTabBar() }
            .navigationDestination(for: StaffClass.self) { StaffClassDetailView(cls: $0, day: IST.todayOn()).hidesTabBar() }
            .navigationDestination(for: AttendanceTarget.self) { StaffAttendanceSheetView(cls: $0.cls, day: $0.day).hidesTabBar() }
        }
        .sheet(isPresented: $showProfile) { StaffProfileSheet() }
    }

    /// The server says which blocks this person gets; this puts them in the order that reads best: attendance first,
    /// then Notices, then the day and My classes. An empty "My classes" is left out for someone who runs a department.
    private var blocks: [String] {
        let layout = context.layout
        let has = Set(layout.blocks)
        let hasWork = !has.isDisjoint(with: ["academic", "fees", "people"])
        var list: [String] = []
        if has.contains("my_classes") { list.append("my_attendance") }
        if has.contains("notices") { list.append("notices") }
        if has.contains("my_day") { list.append("my_day") }
        if has.contains("my_classes"), layout.hasAssignments || !hasWork { list.append("my_classes") }
        for name in ["fees", "people"] where has.contains(name) { list.append(name) }
        return list
    }

    @ViewBuilder
    private func block(_ name: String) -> some View {
        switch name {
        case "my_attendance": MyAttendanceCard()
        case "my_day": MyDayBlock(go: { path.append($0) }, hideIfEmpty: context.layout.blocks.contains { ["academic", "fees", "people"].contains($0) })
        case "my_classes": MyClassesBlock(go: { path.append($0) })
        case "notices": NoticesBlock(go: { path.append($0) }, open: { path.append($0) })
        case "fees": FeesBlock(go: go)
        case "people": PeopleBlock(open: { path.append(HomeRoute.people) })
        default: EmptyView()   // a block this build does not know: skipped
        }
    }

    /// The school's logo and name on the left, and on the right the person's own picture in a glass ring. Tap it for
    /// their profile. The date sits quietly under the school name.
    private var header: some View {
        HStack(alignment: .center, spacing: Tokens.Space.s3) {
            SchoolMark(logoUrl: context.me.school?.logoUrl, name: context.me.school?.name ?? "Krevo", size: 48)
            VStack(alignment: .leading, spacing: 2) {
                Text(context.me.school?.name ?? "Krevo").font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.text).lineLimit(1)
                Text(IST.date(IST.todayOn())).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
            }
            Spacer(minLength: Tokens.Space.s2)
            Button { showProfile = true } label: {
                RemoteAvatar(url: context.me.photoUrl, initials: initials, size: 40)
                    .padding(4)
                    .chromeSurface(in: Circle(), interactive: true)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Your profile")
        }
    }

    private var initials: String {
        context.me.name.split(separator: " ").prefix(2).compactMap { $0.first }.map(String.init).joined().uppercased()
    }
}

/// "₹62,550" for small amounts, "₹1.5L" or "₹2.1Cr" for big ones, so a number never wraps in a narrow column.
func compactRupees(_ paise: Int) -> String {
    let rupees = Double(paise) / 100
    if rupees >= 1_00_00_000 { return String(format: "₹%.1fCr", rupees / 1_00_00_000) }
    if rupees >= 1_00_000 { return String(format: "₹%.1fL", rupees / 1_00_000) }
    return Money.format(paise: paise)
}

/// One period on a day's timeline: time on the left, a rail with a dot, then subject and class.
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
