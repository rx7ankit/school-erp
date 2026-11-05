import SwiftUI

/// Attendance tab: the whole academic year at a glance, then month by month. A month opens as a calendar.
struct AttendanceView: View {
    let child: Child

    @Environment(Session.self) private var session
    @State private var vm = YearAttendanceViewModel()
    /// Months shown open. The current month starts open, the rest closed.
    @State private var openMonths: Set<String> = [IST.currentMonth()]

    var body: some View {
        NavigationStack {
            ScreenScroll {
                TwoToneTitle(ink: L.t("att.title"), grey: "", role: .title1)

                LoadableView(vm.state, retry: { Task { await reload() } }, skeleton: { YearSkeleton() }) { year in
                    yearCard(year)
                    SectionLabel(L.t("att.by_month"))
                    Legend()
                    VStack(spacing: Tokens.Space.s3) {
                        ForEach(year.months.reversed()) { row in
                            MonthRow(row: row, isOpen: openMonths.contains(row.month)) { toggle(row.month) }
                        }
                    }
                }
            }
            .refreshable { await reload() }
            .toolbar(.hidden, for: .navigationBar)
        }
        .task(id: child.id) { await reload() }
    }

    private func reload() async {
        await vm.load(repo: session.repo, childId: child.id)
    }

    private func toggle(_ month: String) {
        Haptics.select()
        withAnimation(.smooth(duration: 0.42)) {
            if openMonths.contains(month) { openMonths.remove(month) } else { openMonths.insert(month) }
        }
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

/// One month: a header that opens and closes, and the calendar inside when open.
private struct MonthRow: View {
    let row: MonthSummary
    let isOpen: Bool
    let toggle: () -> Void

    var body: some View {
        let s = row.stats
        Card {
            VStack(alignment: .leading, spacing: 0) {
                Button(action: toggle) {
                    VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                        HStack {
                            Text(IST.monthTitle(row.month)).font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.text)
                            Spacer()
                            Text(s.total == 0 ? "–" : "\(Int(s.percentage.rounded()))%")
                                .font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.text).monospacedDigit()
                        }
                        if s.total > 0 { ProgressBar(fraction: s.percentage / 100, tint: Tokens.success) }
                        HStack(alignment: .center) {
                            Text(s.total > 0 ? summary(s) : L.t("att.no_marks"))
                                .font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
                            Spacer()
                            // The arrow sits at the bottom right of the header, under the percentage.
                            Image(systemName: "chevron.down")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Tokens.textTertiary)
                                .rotationEffect(.degrees(isOpen ? 180 : 0))
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(.isButton)
                .accessibilityValue(isOpen ? "expanded" : "collapsed")

                Collapsible(isOpen: isOpen) {
                    MonthGrid(month: row.month, days: row.days)
                        .padding(.top, Tokens.Space.s4)
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

