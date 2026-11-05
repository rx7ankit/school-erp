import SwiftUI

/// Sunday-first month calendar with a marker under each day.
struct MonthGrid: View {
    let month: String           // "yyyy-MM"
    let days: [AttendanceDay]

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 0), count: 7)
    /// Sunday first, one letter each: "S M T W T F S".
    private var weekdays: [String] { L.t("cal.weekdays").split(separator: " ").map(String.init) }

    private var statusByDay: [String: AttendanceStatus] {
        Dictionary(days.map { ($0.on, $0.status) }, uniquingKeysWith: { first, _ in first })
    }

    var body: some View {
        let lookup = statusByDay
        let today = IST.todayOn()
        VStack(spacing: Tokens.Space.s2) {
            LazyVGrid(columns: columns, spacing: 0) {
                ForEach(0..<7, id: \.self) { i in
                    Text(weekdays[i])
                        .font(.sc(.caption, weight: .semibold))
                        .foregroundStyle(Tokens.textTertiary)
                        .frame(maxWidth: .infinity, minHeight: 28)
                        .accessibilityHidden(true)
                }
            }
            LazyVGrid(columns: columns, spacing: 0) {
                ForEach(0..<IST.firstWeekdayIndex(month), id: \.self) { _ in
                    Color.clear.frame(height: Tokens.Control.md + 8)
                }
                ForEach(1...IST.daysInMonth(month), id: \.self) { d in
                    let on = IST.dayOn(month, d)
                    DayCell(day: d, on: on, status: lookup[on], isToday: on == today)
                }
            }
        }
    }
}

private struct DayCell: View {
    let day: Int
    let on: String
    let status: AttendanceStatus?
    let isToday: Bool

    /// Soft background of the day's circle. No border, just a light tint of the status colour.
    private var tint: Color? {
        switch status {
        case .present: return Tokens.success
        case .absent: return Tokens.danger
        case .halfDayFirst, .halfDaySecond: return Tokens.warning
        case .leave: return Tokens.leave
        case .holiday: return Tokens.holiday
        default: return nil
        }
    }

    private var numberColor: Color {
        if status == .holiday { return Tokens.textSecondary }
        return Tokens.text
    }

    var body: some View {
        Text("\(day)")
            .font(.sc(.callout, weight: isToday ? Font.Weight.bold : Font.Weight.medium))
            .foregroundStyle(numberColor)
            .frame(width: 38, height: 38)
            .background((tint ?? .clear).opacity(status == .holiday ? 0.22 : 0.17), in: Circle())
            .frame(maxWidth: .infinity, minHeight: Tokens.Control.md + 8)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(IST.date(on)), \(status?.title ?? L.t("att.no_record"))")
    }
}

/// Outlined dot with one half filled.
struct HalfDot: View {
    let color: Color
    let filledLeading: Bool
    var size: CGFloat = 9

    var body: some View {
        ZStack {
            Circle().stroke(color, lineWidth: 1.5)
            Circle()
                .fill(color)
                .mask(alignment: filledLeading ? .leading : .trailing) {
                    Rectangle().frame(width: size / 2)
                }
        }
        .frame(width: size, height: size)
    }
}

struct Legend: View {
    var body: some View {
        HStack(spacing: Tokens.Space.s3) {
            item(Circle().fill(Tokens.success.opacity(0.35)).frame(width: 12, height: 12), L.t("att.status.present"))
            item(Circle().fill(Tokens.danger.opacity(0.35)).frame(width: 12, height: 12), L.t("att.status.absent"))
            item(Circle().fill(Tokens.warning.opacity(0.35)).frame(width: 12, height: 12), L.t("att.half_day"))
            item(Circle().fill(Tokens.leave.opacity(0.35)).frame(width: 12, height: 12), L.t("att.leave"))
            item(Circle().fill(Tokens.holiday.opacity(0.45)).frame(width: 12, height: 12), L.t("att.status.holiday"))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func item<V: View>(_ mark: V, _ title: String) -> some View {
        HStack(spacing: 6) {
            mark
            Text(title).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
        }
        .accessibilityElement(children: .combine)
    }
}
