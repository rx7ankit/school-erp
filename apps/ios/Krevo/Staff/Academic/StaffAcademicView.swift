import SwiftUI
import PhotosUI

/// The Academic tab, as bento tiles: a large Classes tile with today's attendance, and smaller tiles for Students, Leave,
/// Timetable and Announcements, each showing one live number or line. Only for whoever holds the Academic permission;
/// teachers reach their own classes and students from Home instead.
struct StaffAcademicView: View {
    enum Route: Hashable { case classes, students, leave, timetable, announcements }

    @Environment(StaffContext.self) private var context
    @State private var dashboard = Loader<StaffDashboard>()
    @State private var day = Loader<StaffDay>()
    @State private var notices = Loader<[Broadcast]>()

    private var canDecideLeave: Bool { context.access.canMarkAttendance }
    private var off: String? { IST.weekdayIndex(IST.todayOn()) == 0 ? "Sunday" : nil }

    var body: some View {
        NavigationStack {
            ScreenScroll {
                classesTile
                HStack(alignment: .top, spacing: Tokens.Space.s3) {
                    studentsTile
                    if canDecideLeave { leaveTile } else { timetableTile }
                }
                if canDecideLeave {
                    HStack(alignment: .top, spacing: Tokens.Space.s3) {
                        timetableTile
                        announcementsTile
                    }
                } else {
                    announcementsTile
                }
                if context.access.isAdmin { SchoolLogoRow() }
            }
            .refreshable { await load() }
            .toolbar(.hidden, for: .navigationBar)
            .task { await load() }
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

    // MARK: Tiles

    /// The big one, in the brand colour.
    private var classesTile: some View {
        NavigationLink(value: Route.classes) {
            VStack(alignment: .leading, spacing: Tokens.Space.s3) {
                HStack {
                    icon("square.grid.2x2", onAccent: true)
                    Spacer()
                    Image(systemName: "arrow.up.right").font(.system(size: 14, weight: .bold)).foregroundStyle(.white.opacity(0.85))
                }
                Spacer(minLength: Tokens.Space.s2)
                Text("Classes").font(.sc(.callout, weight: .semibold)).foregroundStyle(.white.opacity(0.85))
                if let a = dashboard.state.value?.attendance {
                    if let off, a.classesMarkedToday == 0 {
                        Text("No school today").font(.sc(.title1)).foregroundStyle(.white)
                        Text(off).font(.sc(.callout)).foregroundStyle(.white.opacity(0.85))
                    } else {
                        Text("\(a.classesMarkedToday) of \(a.classesTotal) marked").font(.sc(.title1)).foregroundStyle(.white).monospacedDigit()
                        BrandProgress(fraction: a.classesTotal == 0 ? 0 : Double(a.classesMarkedToday) / Double(a.classesTotal), tint: .white, track: .white.opacity(0.28))
                        Text(a.todayPercentage.map { String(format: "%.0f%% present today", $0) } ?? "Attendance not taken yet")
                            .font(.sc(.callout)).foregroundStyle(.white.opacity(0.9))
                    }
                } else {
                    SkeletonLine(width: 150, role: .title1)
                }
            }
            .padding(Tokens.Space.s5)
            .frame(maxWidth: .infinity, minHeight: 190, alignment: .topLeading)
            .background(Tokens.accent, in: RoundedRectangle(cornerRadius: 30, style: .continuous))
        }
        .buttonStyle(.pressable)
    }

    private var studentsTile: some View {
        tile("Students", "person.2", .students) {
            if let d = dashboard.state.value {
                Text("\(d.students)").font(.sc(.title1)).foregroundStyle(Tokens.text).monospacedDigit()
                Text("in \(d.classes) \(d.classes == 1 ? "class" : "classes")").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
            } else { SkeletonLine(width: 60, role: .title1) }
        }
    }

    private var leaveTile: some View {
        tile("Leave requests", "calendar.badge.minus", .leave) {
            let n = context.pendingLeaves
            Text(n == 0 ? "All clear" : "\(n)").font(.sc(.title1)).foregroundStyle(n == 0 ? Tokens.success : Tokens.accent).monospacedDigit()
            Text(n == 0 ? "nothing waiting" : "to decide").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
        }
    }

    private var timetableTile: some View {
        tile("Timetable", "tablecells", .timetable) {
            if let entries = day.state.value?.entries {
                let now = IST.nowHM()
                let next = entries.sorted { $0.slot.startsAt < $1.slot.startsAt }.first { String($0.slot.endsAt.prefix(5)) > now }
                if let e = next {
                    Text(e.slot.subjectName).font(.sc(.title3)).foregroundStyle(Tokens.text).lineLimit(1)
                    Text("Class \(e.slot.classLabel) · \(Text.clock(e.slot.startsAt))").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary).lineLimit(1)
                } else {
                    Text(entries.isEmpty ? "Free day" : "Done today").font(.sc(.title3)).foregroundStyle(Tokens.text)
                    Text("My timetable").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                }
            } else { SkeletonLine(width: 90, role: .title3) }
        }
    }

    private var announcementsTile: some View {
        tile("Announcements", "megaphone", .announcements) {
            if let latest = notices.state.value?.first {
                Text(latest.title).font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.text).lineLimit(2)
                Text(IST.dateTime(latest.createdAt)).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
            } else if notices.state.value != nil {
                Text("Nothing sent yet").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
            } else { SkeletonLine(width: 110, role: .body) }
        }
    }

    private func tile<Content: View>(_ title: String, _ systemImage: String, _ route: Route, @ViewBuilder content: () -> Content) -> some View {
        NavigationLink(value: route) {
            VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                HStack {
                    icon(systemImage, onAccent: false)
                    Spacer()
                    Image(systemName: "arrow.up.right").font(.system(size: 12, weight: .bold)).foregroundStyle(Tokens.textTertiary)
                }
                Spacer(minLength: Tokens.Space.s2)
                Text(title).font(.sc(.caption, weight: .semibold)).foregroundStyle(Tokens.textSecondary).textCase(.uppercase)
                content()
            }
            .padding(Tokens.Space.s4)
            .frame(maxWidth: .infinity, minHeight: 150, alignment: .topLeading)
            .background(Tokens.card, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        }
        .buttonStyle(.pressable)
    }

    private func icon(_ name: String, onAccent: Bool) -> some View {
        Image(systemName: name).font(.system(size: 16, weight: .semibold))
            .foregroundStyle(Tokens.accent)
            .frame(width: 38, height: 38)
            .background(onAccent ? Color.white : Tokens.accentSubtle, in: Circle())
    }

    private func load() async {
        async let a: () = dashboard.load { try await context.repo.dashboard() }
        async let b: () = day.load { try await context.repo.myDay(on: IST.todayOn()) }
        async let c: () = notices.load { try await context.repo.broadcasts() }
        _ = await (a, b, c)
        await context.refreshPendingLeaves()
    }
}


/// Set, change or remove the school's logo. Only people with full access see this; the server enforces it too. Everyone in the
/// school then sees it on Home and in the notices.
private struct SchoolLogoRow: View {
    @Environment(StaffContext.self) private var context
    @State private var picked: PhotosPickerItem?
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s3) {
            HStack(spacing: Tokens.Space.s3) {
                SchoolMark(logoUrl: context.me.school?.logoUrl, name: context.me.school?.name ?? "Krevo", size: 56)
                VStack(alignment: .leading, spacing: 2) {
                    Text("School logo").font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.text)
                    Text(context.me.school?.logoUrl == nil ? "Not set yet" : "Shown on Home and in notices").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                }
                Spacer(minLength: 0)
                if busy { ProgressView() }
            }
            HStack(spacing: Tokens.Space.s2) {
                PhotosPicker(selection: $picked, matching: .images) {
                    Text(context.me.school?.logoUrl == nil ? "Choose a logo" : "Change").font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.text)
                        .padding(.horizontal, 18).frame(minHeight: 42).background(Tokens.bg, in: Capsule())
                }
                if context.me.school?.logoUrl != nil {
                    Button("Remove") { Task { await save(nil) } }
                        .font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.textSecondary).frame(minHeight: 42).padding(.horizontal, 8)
                }
            }
            .disabled(busy)
            if let error { Text(error).font(.sc(.callout)).foregroundStyle(Tokens.danger) }
        }
        .padding(Tokens.Space.s5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Tokens.card, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .onChange(of: picked) { _, item in
            guard let item else { return }
            Task {
                defer { picked = nil }
                guard let data = try? await item.loadTransferable(type: Data.self), let jpeg = StaffProfileSheet.jpeg(from: data) else {
                    error = "That picture could not be read."; return
                }
                await save(jpeg)
            }
        }
    }

    private func save(_ jpeg: Data?) async {
        busy = true; error = nil
        defer { busy = false }
        do { try await context.repo.setSchoolLogo(jpeg: jpeg); await context.refreshMe(); Haptics.success() }
        catch { self.error = (error as? ApiError)?.message ?? "The logo could not be saved. Try again." }
    }
}
