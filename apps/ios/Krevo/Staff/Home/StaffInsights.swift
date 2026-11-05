import SwiftUI
import Charts

/// Attendance over the last two weeks as a soft area line. Scrubbing is not needed: the last day is called out.
struct AttendanceTrendCard: View {
    let insight: AttendanceInsight

    private struct Point: Identifiable { let id: String; let date: Date; let value: Double }

    private var points: [Point] {
        insight.trend.compactMap { t in t.percentage.map { Point(id: t.dayOn, date: IST.pickerDate(on: t.dayOn), value: $0) } }
    }

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: Tokens.Space.s3) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Attendance").font(.sc(.body, weight: .semibold))
                        Text("Last 14 days").font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
                    }
                    Spacer()
                    if let overall = insight.overallPercentage {
                        Text(String(format: "%.1f%%", overall)).font(.sc(.title3)).monospacedDigit()
                    }
                }
                if points.count > 1 {
                    let low = max(0, (points.map(\.value).min() ?? 80) - 8)
                    Chart(points) { p in
                        AreaMark(x: .value("Day", p.date), y: .value("Present", p.value))
                            .interpolationMethod(.monotone)
                            .foregroundStyle(LinearGradient(colors: [Tokens.accent.opacity(0.20), Tokens.accent.opacity(0.01)], startPoint: .top, endPoint: .bottom))
                        LineMark(x: .value("Day", p.date), y: .value("Present", p.value))
                            .interpolationMethod(.monotone)
                            .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round))
                            .foregroundStyle(Tokens.accent)
                        if p.id == points.last?.id {
                            PointMark(x: .value("Day", p.date), y: .value("Present", p.value))
                                .symbolSize(70)
                                .foregroundStyle(Tokens.accent)
                        }
                    }
                    .chartYScale(domain: low...100)
                    .chartYAxis {
                        AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) { value in
                            AxisGridLine().foregroundStyle(Tokens.separator.opacity(0.6))
                            AxisValueLabel { if let v = value.as(Double.self) { Text("\(Int(v))%").font(.sc(.caption)).foregroundStyle(Tokens.textTertiary) } }
                        }
                    }
                    .chartXAxis {
                        AxisMarks(values: .automatic(desiredCount: 4)) { value in
                            AxisValueLabel { if let d = value.as(Date.self) { Text(d, format: .dateTime.day().month(.abbreviated)).font(.sc(.caption)).foregroundStyle(Tokens.textTertiary) } }
                        }
                    }
                    .frame(height: 150)
                    .accessibilityLabel("Attendance over the last 14 days")
                } else {
                    Text("Not enough marked days yet.").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                }
            }
        }
    }
}

/// Fees collected against billed, as a ring, with what is still owed.
struct FeesRingCard: View {
    let summary: FeesSummary

    private var fraction: Double { min(1, max(0, (summary.collectionPercentage ?? 0) / 100)) }

    var body: some View {
        Card {
            HStack(spacing: Tokens.Space.s4) {
                ZStack {
                    Circle().stroke(Tokens.fill, lineWidth: 12)
                    Circle().trim(from: 0, to: fraction)
                        .stroke(Tokens.accent, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    VStack(spacing: 0) {
                        Text("\(Int((summary.collectionPercentage ?? 0).rounded()))%").font(.sc(.title3)).monospacedDigit()
                        Text("collected").font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
                    }
                }
                .frame(width: 112, height: 112)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(Int((summary.collectionPercentage ?? 0).rounded())) percent of fees collected")

                VStack(alignment: .leading, spacing: Tokens.Space.s3) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Fees").font(.sc(.body, weight: .semibold))
                        Text(summary.year ?? "This year").font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
                    }
                    figure("Collected", rupees(summary.collectedPaise), Tokens.text)
                    figure("Dues", rupees(summary.duesPaise), Tokens.text)
                    figure("Overdue", rupees(summary.overduePaise), summary.overduePaise > 0 ? Tokens.danger : Tokens.text)
                }
                Spacer(minLength: 0)
            }
        }
    }

    private func figure(_ label: String, _ value: String, _ color: Color) -> some View {
        HStack {
            Text(label).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
            Spacer(minLength: Tokens.Space.s2)
            Text(value).font(.sc(.callout, weight: .semibold)).foregroundStyle(color).monospacedDigit()
        }
    }
}
