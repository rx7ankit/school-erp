import SwiftUI

/// Weekly timetable of the child's class: days across, periods down. Scrolls sideways on small screens.
struct TimetableView: View {
    let child: Child

    @Environment(Session.self) private var session
    @State private var vm = TimetableViewModel()

    private let periodWidth: CGFloat = 76
    private let dayWidth: CGFloat = 118
    private let gap: CGFloat = 6
    private let days = ["tt.day.1", "tt.day.2", "tt.day.3", "tt.day.4", "tt.day.5", "tt.day.6"]

    var body: some View {
        ScreenScroll {
            TwoToneTitle(ink: L.t("tt.ink"), grey: L.f("tt.grey", child.firstName), role: .title1)

            LoadableView(vm.timetable, retry: { Task { await reload() } }) { table in
                if table.periods.isEmpty {
                    EmptyNote(text: L.t("tt.empty"))
                } else {
                    Text(L.f("tt.class_fmt", table.classLabel))
                        .font(.sc(.callout))
                        .foregroundStyle(Tokens.textSecondary)
                    ScrollView(.horizontal, showsIndicators: false) {
                        grid(table)
                    }
                    Text(L.t("tt.times_note"))
                        .font(.sc(.caption))
                        .foregroundStyle(Tokens.textTertiary)
                }
            }
        }
        .refreshable { await reload() }
        .navigationBarTitleDisplayMode(.inline)
        .task { await reload() }
    }

    private func reload() async {
        await vm.load(repo: session.repo, childId: child.id)
    }

    private func grid(_ table: Timetable) -> some View {
        let today = TimetableViewModel.todayWeekday()
        let todayOn = IST.todayOn()
        return VStack(alignment: .leading, spacing: gap) {
            HStack(spacing: gap) {
                Color.clear.frame(width: periodWidth, height: 1)
                ForEach(1...6, id: \.self) { weekday in
                    Text(L.t(days[weekday - 1]))
                        .font(.sc(.callout, weight: .semibold))
                        .foregroundStyle(weekday == today ? Tokens.accent : Tokens.textSecondary)
                        .frame(width: dayWidth, height: Tokens.Control.sm)
                        .background(weekday == today ? Tokens.accentSubtle : Color.clear,
                                    in: RoundedRectangle(cornerRadius: Tokens.Radius.control, style: .continuous))
                }
            }
            ForEach(table.periods) { period in
                if period.isBreak {
                    breakRow(period)
                } else {
                    HStack(alignment: .top, spacing: gap) {
                        periodCell(period)
                        ForEach(1...6, id: \.self) { weekday in
                            let isToday = weekday == today
                            let substitute = isToday ? substitution(in: table, period: period.id, on: todayOn) : nil
                            cell(table.slot(period: period.id, weekday: weekday), isToday: isToday, substitute: substitute)
                        }
                    }
                }
            }
        }
    }

    private func substitution(in table: Timetable, period: Int, on: String) -> Substitution? {
        table.substitutions.first(where: { $0.on == on && $0.periodId == period })
    }

    private func periodCell(_ period: Period) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(L.f("tt.period_fmt", period.label))
                .font(.sc(.callout, weight: .semibold))
                .foregroundStyle(Tokens.text)
            // IST clock text exactly as stored. Never converted.
            Text("\(period.start) - \(period.end)")
                .font(.sc(.caption))
                .foregroundStyle(Tokens.textSecondary)
        }
        .frame(width: periodWidth, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private func breakRow(_ period: Period) -> some View {
        HStack(spacing: gap) {
            periodCell(period)
            Text(L.t("tt.break"))
                .font(.sc(.callout))
                .foregroundStyle(Tokens.textSecondary)
                .frame(width: dayWidth * 6 + gap * 5, height: Tokens.Control.sm)
                .background(Tokens.fill, in: RoundedRectangle(cornerRadius: Tokens.Radius.control, style: .continuous))
        }
    }

    private func cell(_ slot: TimetableSlot?, isToday: Bool, substitute: Substitution?) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            if let slot {
                Text(L.known("subject", slot.subject))
                    .font(.sc(.callout, weight: .semibold))
                    .foregroundStyle(Tokens.text)
                if let substitute {
                    Text(L.f("tt.substitute", substitute.teacher))
                        .font(.sc(.caption, weight: .semibold))
                        .foregroundStyle(Tokens.accent)
                } else {
                    Text(slot.teacher)
                        .font(.sc(.caption))
                        .foregroundStyle(Tokens.textSecondary)
                }
            }
        }
        .padding(Tokens.Space.s2)
        .frame(width: dayWidth, alignment: .topLeading)
        .frame(minHeight: 64, alignment: .topLeading)
        .background(isToday ? Tokens.accentSubtle : Tokens.card,
                    in: RoundedRectangle(cornerRadius: Tokens.Radius.control, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}
