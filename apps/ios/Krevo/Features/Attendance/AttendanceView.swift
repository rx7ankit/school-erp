import SwiftUI

struct AttendanceView: View {
    let child: Child

    @Environment(Session.self) private var session
    @State private var vm = AttendanceViewModel()

    var body: some View {
        NavigationStack {
            ScreenScroll {
                TwoToneTitle(ink: L.t("att.ink"), grey: L.f("att.grey", child.firstName), role: .title1)
                monthBar
                LoadableView(vm.days, retry: { Task { await reload() } }, skeleton: { AttendanceSkeleton() }) { days in
                    stats(for: days)
                    MonthGrid(month: vm.month, days: days)
                    Legend()
                }
            }
            .refreshable { await reload() }
            .toolbar(.hidden, for: .navigationBar)
        }
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

private struct StatItem: View {
    let value: Int
    let title: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(value)").font(.sc(.title3)).foregroundStyle(Tokens.text)
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
