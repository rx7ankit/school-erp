import SwiftUI

/// Pick a class, then change its weekly timetable. Only for whoever holds the Academic permission.
struct StaffTimetableClassPicker: View {
    @Environment(StaffContext.self) private var context

    var body: some View {
        ScreenScroll {
            Text("Choose a class.").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
            VStack(spacing: 0) {
                ForEach(Array(context.classes.enumerated()), id: \.element.id) { i, c in
                    NavigationLink { StaffTimetableEditorView(cls: c).hidesTabBar() } label: {
                        PlainLine(showsDivider: i < context.classes.count - 1) {
                            HStack {
                                Text("Class \(c.label)").font(.sc(.body, weight: .medium)).foregroundStyle(Tokens.text)
                                Spacer()
                                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Tokens.textTertiary)
                            }
                        }
                    }
                    .buttonStyle(.pressable)
                }
            }
        }
        .navigationTitle("Edit timetable")
        .navigationBarTitleDisplayMode(.large)
    }
}

/// One class, one weekday at a time: every period with its lesson, or a free slot to fill. Tap a period to set the lesson
/// (a subject and its teacher, taken from who is assigned to the class) or to remove it. The server refuses a clash, and
/// the message is shown as it is.
struct StaffTimetableEditorView: View {
    let cls: StaffClass
    @Environment(StaffContext.self) private var context
    @State private var data = Loader<ClassTimetable>()
    @State private var choices: [LessonChoice] = []
    @State private var day = String(min(6, max(1, (IST.weekdayIndex(IST.todayOn()) + 6) % 7 + 1)))
    @State private var target: Target?
    @State private var assigning = false

    struct LessonChoice: Identifiable, Hashable {
        let subjectId: String, subject: String, staffId: String, teacher: String
        var id: String { subjectId + "|" + staffId }
    }

    struct Target: Identifiable {
        let period: TimetablePeriod
        let lesson: TimetableLesson?
        var id: String { period.id }
    }

    private static let days = ["1": "Mon", "2": "Tue", "3": "Wed", "4": "Thu", "5": "Fri", "6": "Sat"]

    var body: some View {
        ScreenScroll {
            ChipRow(options: ["1", "2", "3", "4", "5", "6"].map { (id: $0, title: Self.days[$0] ?? $0) }, selection: $day)
            LoadableView(data.state, retry: { Task { await load() } }) { t in
                if t.periods.isEmpty {
                    EmptyNote(text: "No periods are set up yet. Add them on the web first.", systemImage: "clock")
                }
                VStack(spacing: 0) {
                    ForEach(Array(t.periods.sorted { $0.number < $1.number }.enumerated()), id: \.element.id) { i, period in
                        let lesson = t.slots.first { $0.weekday == Int(day) && $0.periodId == period.id }
                        Button { target = Target(period: period, lesson: lesson) } label: {
                            PlainLine(showsDivider: i < t.periods.count - 1) { row(period, lesson) }
                        }
                        .buttonStyle(.pressable)
                    }
                }
            }
        }
        .navigationTitle("Class \(cls.label)")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { assigning = true } label: { Label("Teachers", systemImage: "person.badge.plus") }
            }
        }
        .task { await load() }
        .sheet(isPresented: $assigning) { StaffAssignTeachersView(cls: cls) { Task { await load() } }.environment(context) }
        .sheet(item: $target) { t in
            LessonSheet(cls: cls, weekday: Int(day) ?? 1, target: t, choices: choices) { target = nil; Task { await load() } }
                .environment(context)
        }
    }

    private func row(_ period: TimetablePeriod, _ lesson: TimetableLesson?) -> some View {
        HStack(spacing: Tokens.Space.s3) {
            VStack(alignment: .leading, spacing: 2) {
                Text(period.name).font(.sc(.body, weight: .medium)).foregroundStyle(Tokens.text)
                Text("\(Text.clock(period.startsAt)) – \(Text.clock(period.endsAt))").font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
            }
            Spacer(minLength: Tokens.Space.s3)
            if let lesson {
                VStack(alignment: .trailing, spacing: 2) {
                    Text(lesson.subjectName).font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.text)
                    Text(lesson.staffName).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
                }
            } else {
                Label("Add", systemImage: "plus").font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.accent)
            }
        }
    }

    private func load() async {
        await data.load { try await context.repo.classTimetable(classId: cls.id) }
        if let rows = try? await context.repo.assignments(classId: cls.id), let subjects = try? await context.repo.subjects() {
            let names = Dictionary(uniqueKeysWithValues: subjects.map { ($0.id, $0.name) })
            choices = rows.compactMap { r in
                guard let sid = r.subjectId, let name = names[sid] else { return nil }
                return LessonChoice(subjectId: sid, subject: name, staffId: r.staffId, teacher: r.staffName)
            }.sorted { ($0.subject, $0.teacher) < ($1.subject, $1.teacher) }
        }
    }
}

/// Choose the lesson for one period: a subject with its teacher, or remove the lesson.
private struct LessonSheet: View {
    let cls: StaffClass
    let weekday: Int
    let target: StaffTimetableEditorView.Target
    let choices: [StaffTimetableEditorView.LessonChoice]
    let done: () -> Void
    @Environment(StaffContext.self) private var context
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        ScreenScroll {
            Text(target.period.name).font(.sc(.title2))
            Text("\(Text.clock(target.period.startsAt)) – \(Text.clock(target.period.endsAt))").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
            if choices.isEmpty {
                Text("No subject teachers are assigned to this class yet. Close this and tap Teachers at the top to assign them.")
                    .font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
            }
            VStack(spacing: 0) {
                ForEach(Array(choices.enumerated()), id: \.element.id) { i, c in
                    Button { Task { await pick(c) } } label: {
                        PlainLine(showsDivider: i < choices.count - 1) {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(c.subject).font(.sc(.body, weight: .medium)).foregroundStyle(Tokens.text)
                                    Text(c.teacher).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
                                }
                                Spacer()
                                if target.lesson?.subjectId == c.subjectId && target.lesson?.staffId == c.staffId {
                                    Image(systemName: "checkmark").font(.system(size: 14, weight: .bold)).foregroundStyle(Tokens.accent)
                                }
                            }
                        }
                    }
                    .buttonStyle(.pressable).disabled(busy)
                }
            }
            if let error { Text(error).font(.sc(.callout)).foregroundStyle(Tokens.danger) }
            if let lesson = target.lesson {
                Button("Remove this lesson", role: .destructive) { Task { await remove(lesson) } }
                    .font(.sc(.callout, weight: .semibold)).frame(minHeight: Tokens.Control.md).disabled(busy)
            }
        }
        .fitSheetScroll()
    }

    private func pick(_ c: StaffTimetableEditorView.LessonChoice) async {
        busy = true; error = nil
        defer { busy = false }
        do {
            if let lesson = target.lesson {
                try await context.repo.changeLesson(id: lesson.id, subjectId: c.subjectId, staffId: c.staffId)
            } else {
                try await context.repo.addLesson(classId: cls.id, weekday: weekday, periodId: target.period.id, subjectId: c.subjectId, staffId: c.staffId)
            }
            Haptics.success(); done()
        } catch { self.error = (error as? ApiError)?.message ?? "That could not be saved. Try again."; Haptics.error() }
    }

    private func remove(_ lesson: TimetableLesson) async {
        busy = true; error = nil
        defer { busy = false }
        do { try await context.repo.deleteLesson(id: lesson.id); Haptics.success(); done() }
        catch { self.error = (error as? ApiError)?.message ?? "That could not be removed. Try again."; Haptics.error() }
    }
}
