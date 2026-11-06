import SwiftUI

/// Who teaches a class: its class teacher and one teacher for each subject it studies. For whoever holds the Academic or the
/// People permission. Tap a row, pick a person (or "No one"); it is saved at once.
struct StaffAssignTeachersView: View {
    let cls: StaffClass
    let changed: () -> Void
    @Environment(StaffContext.self) private var context
    @State private var rows: [Row] = []
    @State private var people: [TeacherChoice] = []
    @State private var loading = true
    @State private var picking: Row?
    @State private var error: String?

    struct Row: Identifiable, Hashable {
        let id: String            // "class" or the subject's id
        let title: String
        var staffId: String?
        var staffName: String?
        var isClassTeacher: Bool { id == "class" }
    }

    var body: some View {
        ScreenScroll {
            Text("Teachers").font(.sc(.title2))
            Text("Class \(cls.label)").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
            if loading {
                ProgressView().frame(maxWidth: .infinity).padding()
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(rows.enumerated()), id: \.element.id) { i, r in
                        Button { picking = r } label: {
                            PlainLine(showsDivider: i < rows.count - 1) {
                                HStack {
                                    Text(r.title).font(.sc(.body, weight: .medium)).foregroundStyle(Tokens.text)
                                    Spacer(minLength: Tokens.Space.s3)
                                    Text(r.staffName ?? "No one").font(.sc(.callout)).foregroundStyle(r.staffName == nil ? Tokens.accent : Tokens.textSecondary)
                                    Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Tokens.textTertiary)
                                }
                            }
                        }
                        .buttonStyle(.pressable)
                    }
                }
                if rows.count == 1 { Text("This class has no subjects yet. Add them on the web, then assign their teachers here.").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary) }
            }
            if let error { Text(error).font(.sc(.callout)).foregroundStyle(Tokens.danger) }
        }
        .task { await load() }
        .sheet(item: $picking) { r in
            PickSheet(title: r.title, current: r.staffId, people: people) { id in
                picking = nil
                Task { await save(r, id) }
            }
        }
        .fitSheetScroll()
    }

    private func load() async {
        do {
            async let a = context.repo.assignments(classId: cls.id)
            async let s = context.repo.subjects()
            async let t = context.repo.teachers()
            let (assignments, subjects, list) = try await (a, s, t)
            people = list
            let names = Dictionary(uniqueKeysWithValues: subjects.map { ($0.id, $0.name) })
            var out = [Row(id: "class", title: "Class teacher",
                           staffId: assignments.first { $0.role == "class_teacher" }?.staffId,
                           staffName: assignments.first { $0.role == "class_teacher" }?.staffName)]
            for sid in (cls.subjectIds ?? []).compactMap({ id in names[id].map { _ in id } }).sorted(by: { (names[$0] ?? "") < (names[$1] ?? "") }) {
                let a = assignments.first { $0.subjectId == sid }
                out.append(Row(id: sid, title: names[sid] ?? "Subject", staffId: a?.staffId, staffName: a?.staffName))
            }
            rows = out
        } catch { self.error = (error as? ApiError)?.message ?? "The teachers could not be loaded." }
        loading = false
    }

    private func save(_ row: Row, _ staffId: String?) async {
        error = nil
        do {
            if row.isClassTeacher { try await context.repo.setClassTeacher(classId: cls.id, staffId: staffId) }
            else { try await context.repo.setSubjectTeacher(classId: cls.id, subjectId: row.id, staffId: staffId) }
            Haptics.success()
            await load()
            await context.refreshMe()
            changed()
        } catch { self.error = (error as? ApiError)?.message ?? "That could not be saved. Try again."; Haptics.error() }
    }
}

private struct PickSheet: View {
    let title: String
    let current: String?
    let people: [TeacherChoice]
    let pick: (String?) -> Void
    @State private var query = ""

    private var shown: [TeacherChoice] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        return q.isEmpty ? people : people.filter { $0.name.lowercased().contains(q) || $0.designation.lowercased().contains(q) }
    }

    var body: some View {
        ScreenScroll {
            Text(title).font(.sc(.title2))
            AppField(title: "Search", text: $query)
            VStack(spacing: 0) {
                Button { pick(nil) } label: {
                    PlainLine(showsDivider: !shown.isEmpty) {
                        HStack { Text("No one").font(.sc(.body, weight: .medium)).foregroundStyle(Tokens.textSecondary); Spacer()
                            if current == nil { Image(systemName: "checkmark").foregroundStyle(Tokens.accent) } }
                    }
                }.buttonStyle(.pressable)
                ForEach(Array(shown.enumerated()), id: \.element.id) { i, t in
                    Button { pick(t.id) } label: {
                        PlainLine(showsDivider: i < shown.count - 1) {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(t.name).font(.sc(.body, weight: .medium)).foregroundStyle(Tokens.text)
                                    if !t.designation.isEmpty { Text(t.designation).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary) }
                                }
                                Spacer()
                                if current == t.id { Image(systemName: "checkmark").foregroundStyle(Tokens.accent) }
                            }
                        }
                    }.buttonStyle(.pressable)
                }
            }
        }
        .fitSheetScroll()
    }
}
