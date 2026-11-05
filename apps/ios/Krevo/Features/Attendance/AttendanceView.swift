import SwiftUI

/// Attendance tab: the whole academic year at a glance, then month by month. A month opens as a calendar.
struct AttendanceView: View {
    let child: Child

    @Environment(Session.self) private var session
    @State private var vm = YearAttendanceViewModel()

    var body: some View {
        NavigationStack {
            ScreenScroll {
                TwoToneTitle(ink: L.f("att.title", child.firstName), grey: "", role: .title1)

                LoadableView(vm.state, retry: { Task { await reload() } }, skeleton: { YearSkeleton() }) { year in
                    yearCard(year)
                    SectionLabel(L.t("att.by_month"))
                    VStack(spacing: Tokens.Space.s3) {
                        ForEach(year.months.reversed()) { row in
                            NavigationLink(value: row.month) { MonthRow(row: row) }
                                .buttonStyle(.pressable)
                        }
                    }
                }
            }
            .refreshable { await reload() }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: String.self) { month in
                AttendanceMonthView(child: child, month: month)
            }
        }
        .task(id: child.id) { await reload() }
    }

    private func reload() async {
        await vm.load(repo: session.repo, childId: child.id)
    }

    private func yearCard(_ year: YearAttendance) -> some View {
        let s = year.total
        return Card {
            VStack(alignment: .leading, spacing: Tokens.Space.s4) {
                Text(L.f("att.this_year", year.label))
                    .font(.sc(.caption, weight: .semibold))
                    .foregroundStyle(Tokens.textSecondary)
                    .textCase(.uppercase)
                if s.total == 0 {
                    Text(L.t("att.no_marks")).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                } else {
                    HStack(alignment: .firstTextBaseline, spacing: Tokens.Space.s2) {
                        Text("\(Int(s.percentage.rounded()))%").font(.sc(.title1)).foregroundStyle(Tokens.text)
                        Text(L.f("att.school_days", String(s.total))).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                    }
                    ProgressBar(fraction: s.percentage / 100, tint: Tokens.success)
                    HStack {
                        StatItem(value: s.present, title: L.t("att.status.present"), tint: Tokens.success)
                        StatItem(value: s.absent, title: L.t("att.status.absent"), tint: Tokens.danger)
                        StatItem(value: s.half, title: L.t("att.half_days"), tint: Tokens.warning)
                        StatItem(value: s.leave, title: L.t("att.leave_days"), tint: Tokens.leave)
                    }
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

private struct MonthRow: View {
    let row: MonthSummary

    var body: some View {
        let s = row.stats
        Card {
            VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                HStack {
                    Text(IST.monthTitle(row.month)).font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.text)
                    Spacer()
                    Text(s.total == 0 ? "–" : "\(Int(s.percentage.rounded()))%")
                        .font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.text).monospacedDigit()
                    Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Tokens.textTertiary)
                }
                if s.total > 0 {
                    ProgressBar(fraction: s.percentage / 100, tint: Tokens.success)
                    Text(summary(s)).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
                } else {
                    Text(L.t("att.no_marks")).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
                }
            }
        }
    }

    private func summary(_ s: AttendanceStats) -> String {
        var parts = ["\(s.present) " + L.t("att.status.present").lowercased(), "\(s.absent) " + L.t("att.status.absent").lowercased()]
        if s.half > 0 { parts.append("\(s.half) " + L.t("att.half_days").lowercased()) }
        if s.leave > 0 { parts.append("\(s.leave) " + L.t("att.leave_days").lowercased()) }
        return parts.joined(separator: " · ")
    }
}

/// Thin rounded bar.
private struct ProgressBar: View {
    let fraction: Double
    let tint: Color

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Tokens.fill)
                Capsule().fill(tint).frame(width: max(6, geo.size.width * min(1, max(0, fraction))))
            }
        }
        .frame(height: 6)
        .accessibilityHidden(true)
    }
}

private struct YearSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s4) {
            SkeletonCard {
                VStack(alignment: .leading, spacing: Tokens.Space.s4) {
                    SkeletonLine(width: 140, role: .caption)
                    SkeletonLine(width: 120, role: .title1)
                    SkeletonBlock(height: 6, radius: 3)
                }
            }
            ForEach(0..<4, id: \.self) { _ in
                SkeletonCard { VStack(alignment: .leading, spacing: 8) { SkeletonLine(width: 130, role: .body); SkeletonBlock(height: 6, radius: 3) } }
            }
        }
    }
}

/// One month as a calendar, with the month arrows. Pushed from the month list.
struct AttendanceMonthView: View {
    let child: Child

    @Environment(Session.self) private var session
    @State private var vm: AttendanceViewModel

    init(child: Child, month: String) {
        self.child = child
        _vm = State(initialValue: AttendanceViewModel(month: month))
    }

    var body: some View {
        ScreenScroll {
            monthBar
            LoadableView(vm.days, retry: { Task { await reload() } }, skeleton: { AttendanceSkeleton() }) { days in
                stats(for: days)
                MonthGrid(month: vm.month, days: days)
                Legend()
            }
        }
        .refreshable { await reload() }
        .navigationBarTitleDisplayMode(.inline)
        .task(id: vm.month) { await reload() }
    }

    private func reload() async {
        await vm.load(repo: session.repo, childId: child.id)
    }

    private var monthBar: some View {
        HStack {
            Button { vm.shift(-1) } label: {
                Image(systemName: "chevron.left")
                    .frame(width: Tokens.Control.md, height: Tokens.Control.md)
            }
            .accessibilityLabel(L.t("att.prev"))
            Spacer()
            Text(IST.monthTitle(vm.month))
                .font(.sc(.title3))
                .foregroundStyle(Tokens.text)
            Spacer()
            Button { vm.shift(1) } label: {
                Image(systemName: "chevron.right")
                    .frame(width: Tokens.Control.md, height: Tokens.Control.md)
            }
            .disabled(!vm.canGoNext)
            .accessibilityLabel(L.t("att.next"))
        }
        .foregroundStyle(Tokens.text)
    }

    private func stats(for days: [AttendanceDay]) -> some View {
        let s = AttendanceStats(days: days)
        return Card {
            VStack(alignment: .leading, spacing: Tokens.Space.s4) {
                HStack(alignment: .firstTextBaseline) {
                    Text("\(Int(s.percentage.rounded()))%")
                        .font(.sc(.title1))
                        .foregroundStyle(Tokens.text)
                    Text(L.t("att.attendance"))
                        .font(.sc(.callout))
                        .foregroundStyle(Tokens.textSecondary)
                }
                HStack {
                    StatItem(value: s.present, title: L.t("att.status.present"))
                    StatItem(value: s.absent, title: L.t("att.status.absent"))
                    StatItem(value: s.half, title: L.t("att.half_days"))
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

struct StatItem: View {
    let value: Int
    let title: String
    var tint: Color = Tokens.text

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(value)").font(.sc(.title3)).foregroundStyle(tint)
            Text(title).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Mirrors the stats card, the Sunday-first month grid and the legend.
private struct AttendanceSkeleton: View {
    private let weekRows = 5

    var body: some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s4) {
            SkeletonCard {
                VStack(alignment: .leading, spacing: Tokens.Space.s4) {
                    HStack(alignment: .firstTextBaseline, spacing: Tokens.Space.s2) {
                        SkeletonLine(width: 84, role: .title1)
                        SkeletonLine(width: 90, role: .callout)
                    }
                    HStack {
                        ForEach(0..<3, id: \.self) { _ in
                            VStack(alignment: .leading, spacing: 2) {
                                SkeletonLine(width: 28, role: .title3)
                                SkeletonLine(width: 52, role: .caption)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
            }
            VStack(spacing: Tokens.Space.s2) {
                HStack(spacing: 0) {
                    ForEach(0..<7, id: \.self) { _ in
                        SkeletonBlock(width: 12, height: 10, radius: 3)
                            .frame(maxWidth: .infinity, minHeight: 28)
                    }
                }
                ForEach(0..<weekRows, id: \.self) { _ in
                    HStack(spacing: 0) {
                        ForEach(0..<7, id: \.self) { _ in
                            SkeletonBlock(width: 20, height: 14, radius: 5)
                                .frame(maxWidth: .infinity, minHeight: Tokens.Control.md + 8)
                        }
                    }
                }
            }
            HStack(spacing: Tokens.Space.s4) {
                ForEach(0..<4, id: \.self) { _ in
                    SkeletonLine(width: 56, role: .caption)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
