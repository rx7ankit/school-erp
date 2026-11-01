import SwiftUI

struct AttendanceView: View {
    let child: Child

    @Environment(Session.self) private var session
    @State private var vm = AttendanceViewModel()

    var body: some View {
        NavigationStack {
            ScreenScroll {
                TwoToneTitle(ink: "Attendance.", grey: "\(child.firstName)'s month.", role: .title1)
                monthBar
                LoadableView(vm.days, retry: { Task { await reload() } }) { days in
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
            .accessibilityLabel("Previous month")
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
            .accessibilityLabel("Next month")
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
                        .foregroundStyle(Tokens.accent)
                    Text("attendance")
                        .font(.sc(.callout))
                        .foregroundStyle(Tokens.textSecondary)
                }
                HStack {
                    StatItem(value: s.present, title: "Present")
                    StatItem(value: s.absent, title: "Absent")
                    StatItem(value: s.half, title: "Half days")
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
