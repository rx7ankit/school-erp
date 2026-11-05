import SwiftUI

/// The signed-in teacher's own day. Pick any weekday of this week.
struct StaffTimetableView: View {
    @Environment(StaffContext.self) private var context
    @State private var day = IST.todayOn()
    @State private var data = Loader<StaffDay>()

    /// Monday to Saturday of the week that contains today.
    private var week: [String] {
        let today = IST.todayOn()
        let index = (IST.weekdayIndex(today) + 6) % 7   // Monday = 0
        let monday = IST.addDays(today, -index)
        return (0..<6).map { IST.addDays(monday, $0) }
    }

    var body: some View {
        ScreenScroll {
            TwoToneTitle(ink: "Timetable", grey: "", role: .title1)
            ChipRow(options: week.map { (id: $0, title: String(IST.weekdayName(on: $0).prefix(3)) + " " + String($0.suffix(2))) }, selection: $day)
            LoadableView(data.state, retry: { Task { await load() } }) { d in
                if d.entries.isEmpty { EmptyNote(text: "No classes this day.") }
                ForEach(d.entries) { StaffPeriodRow(entry: $0) }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task(id: day) { await load() }
    }

    private func load() async { await data.load { try await context.repo.myDay(on: day) } }
}
