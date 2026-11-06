import SwiftUI

/// A class's teachers, kept simple: the class teacher, then one row per subject, each showing the name with the teacher under
/// it and an Edit button. Edit changes the teacher or (for a subject) removes it from the class; "New subject" adds one.
/// Editing is for whoever holds the Academic or the People permission; everyone else just reads.
struct ClassTeachersSection: View {
    let cls: StaffClass
    var changed: () -> Void = {}
    /// When the page puts its own "New subject" button elsewhere, it passes the flag that button sets and this one is hidden.
    var addingBinding: Binding<Bool>?

    @Environment(StaffContext.self) private var context
    @State private var rows: [Row] = []
    @State private var people: [TeacherChoice] = []
    @State private var subjectIds: [String] = []
    @State private var allSubjects: [StaffSubject] = []
    @State private var loading = true
    @State private var editing: Row?
    @State private var localAdding = false
    private var adding: Binding<Bool> { addingBinding ?? $localAdding }
    @State private var error: String?

    struct Row: Identifiable, Hashable {
        let id: String            // "class" or the subject's id
        let title: String
        var staffId: String?
        var staffName: String?
        var isClassTeacher: Bool { id == "class" }
    }

    private var canEdit: Bool { context.access.canSeeAcademic || context.access.canManagePeople }

    var body: some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s3) {
            if loading {
                ProgressView().frame(maxWidth: .infinity).padding()
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(rows.enumerated()), id: \.element.id) { i, r in
                        PlainLine(showsDivider: i < rows.count - 1) {
                            HStack(alignment: .center, spacing: Tokens.Space.s3) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(r.title).font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.text)
                                    Text(r.staffName ?? "No teacher").font(.sc(.callout)).foregroundStyle(r.staffName == nil ? Tokens.accent : Tokens.textSecondary)
                                }
                                Spacer(minLength: 0)
                                if canEdit {
                                    Button("Edit") { editing = r }
                                        .font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.text)
                                        .padding(.horizontal, 16).frame(minHeight: 36).background(Tokens.card, in: Capsule())
                                        .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }
                if canEdit && addingBinding == nil {
                    Button { adding.wrappedValue = true } label: {
                        Label("New subject", systemImage: "plus").font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.text)
                            .frame(maxWidth: .infinity, minHeight: 46).background(Tokens.card, in: Capsule())
                    }
                    .buttonStyle(.pressable)
                }
            }
            if let error { Text(error).font(.sc(.callout)).foregroundStyle(Tokens.danger) }
        }
        .task { subjectIds = cls.subjectIds ?? []; await load() }
        .sheet(item: $editing) { r in
            EditRowSheet(row: r, people: people) { change in
                editing = nil
                Task { await apply(change, to: r) }
            }
        }
        .sheet(isPresented: adding) {
            NewSubjectSheet(existing: allSubjects.filter { !subjectIds.contains($0.id) }) { picked in
                adding.wrappedValue = false
                Task { await add(picked) }
            }
        }
    }

    private func load() async {
        do {
            async let a = context.repo.assignments(classId: cls.id)
            async let s = context.repo.subjects()
            // The picker list is only needed when someone taps Edit, so a failure here must not hide the rows.
            async let t = try? context.repo.teachers()
            let (assignments, subjects, list) = try await (a, s, t)
            people = list ?? people; allSubjects = subjects
            let names = Dictionary(uniqueKeysWithValues: subjects.map { ($0.id, $0.name) })
            let ct = assignments.first { $0.role == "class_teacher" }
            var out = [Row(id: "class", title: "Class teacher", staffId: ct?.staffId, staffName: ct?.staffName)]
            for sid in subjectIds.filter({ names[$0] != nil }).sorted(by: { (names[$0] ?? "") < (names[$1] ?? "") }) {
                let a = assignments.first { $0.subjectId == sid }
                out.append(Row(id: sid, title: names[sid] ?? "Subject", staffId: a?.staffId, staffName: a?.staffName))
            }
            rows = out
        } catch { self.error = (error as? ApiError)?.message ?? "The teachers could not be loaded." }
        loading = false
    }

    private func apply(_ change: ClassTeachersSectionChange, to row: Row) async {
        error = nil
        do {
            switch change {
            case .teacher(let id):
                if row.isClassTeacher { try await context.repo.setClassTeacher(classId: cls.id, staffId: id) }
                else { try await context.repo.setSubjectTeacher(classId: cls.id, subjectId: row.id, staffId: id) }
            case .removeSubject:
                subjectIds.removeAll { $0 == row.id }
                try await context.repo.setClassSubjects(classId: cls.id, subjectIds: subjectIds)
            }
            Haptics.success()
            await load(); await context.loadClasses(); changed()
        } catch {
            if case .removeSubject = change { subjectIds = cls.subjectIds ?? subjectIds }
            self.error = (error as? ApiError)?.message ?? "That could not be saved. Try again."; Haptics.error()
        }
    }

    /// Adds a subject to the class: an existing one the class does not have yet, or a brand new one made by name.
    private func add(_ picked: NewSubjectSheet.Pick) async {
        error = nil
        do {
            let id: String
            switch picked {
            case .existing(let s): id = s.id
            case .new(let name): id = try await context.repo.createSubject(name: name).id
            }
            subjectIds.append(id)
            try await context.repo.setClassSubjects(classId: cls.id, subjectIds: subjectIds)
            Haptics.success()
            await load(); await context.loadClasses(); changed()
        } catch {
            subjectIds = cls.subjectIds ?? subjectIds
            self.error = (error as? ApiError)?.message ?? "That could not be added. Try again."; Haptics.error()
        }
    }
}

/// The same section on its own screen, for the timetable editor.
struct StaffAssignTeachersView: View {
    let cls: StaffClass
    let changed: () -> Void

    var body: some View {
        ScreenScroll {
            Text("Class \(cls.label)").font(.sc(.title2))
            ClassTeachersSection(cls: cls, changed: changed)
        }
        .fitSheetScroll()
    }
}

/// Change who teaches, or (for a subject) take it out of the class.
private struct EditRowSheet: View {
    let row: ClassTeachersSection.Row
    let people: [TeacherChoice]
    let done: (ClassTeachersSectionChange) -> Void
    @State private var query = ""

    private var shown: [TeacherChoice] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        return q.isEmpty ? people : people.filter { $0.name.lowercased().contains(q) || $0.designation.lowercased().contains(q) }
    }

    var body: some View {
        ScreenScroll {
            Text(row.title).font(.sc(.title2))
            Text("Who teaches it").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
            AppField(title: "Search", text: $query)
            VStack(spacing: 0) {
                pickRow("No teacher", sub: nil, selected: row.staffId == nil, last: shown.isEmpty) { done(ClassTeachersSectionChange.teacher(nil)) }
                ForEach(Array(shown.enumerated()), id: \.element.id) { i, t in
                    pickRow(t.name, sub: t.designation.isEmpty ? nil : t.designation, selected: row.staffId == t.id, last: i == shown.count - 1) {
                        done(ClassTeachersSectionChange.teacher(t.id))
                    }
                }
            }
            if !row.isClassTeacher {
                Button("Remove this subject from the class", role: .destructive) { done(ClassTeachersSectionChange.removeSubject) }
                    .font(.sc(.callout, weight: .semibold)).frame(minHeight: Tokens.Control.md)
            }
        }
        .fitSheetScroll()
    }

    private func pickRow(_ title: String, sub: String?, selected: Bool, last: Bool, tap: @escaping () -> Void) -> some View {
        Button(action: tap) {
            PlainLine(showsDivider: !last) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title).font(.sc(.body, weight: .medium)).foregroundStyle(Tokens.text)
                        if let sub { Text(sub).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary) }
                    }
                    Spacer()
                    if selected { Image(systemName: "checkmark").font(.system(size: 14, weight: .bold)).foregroundStyle(Tokens.accent) }
                }
            }
        }
        .buttonStyle(.pressable)
    }
}

/// What the edit sheet hands back.
enum ClassTeachersSectionChange { case teacher(String?), removeSubject }

/// Add a subject to the class: type a new name, or pick one the school already has.
private struct NewSubjectSheet: View {
    enum Pick { case existing(StaffSubject), new(String) }
    let existing: [StaffSubject]
    let done: (Pick) -> Void
    @State private var name = ""

    var body: some View {
        ScreenScroll {
            Text("New subject").font(.sc(.title2))
            AppField(title: "Subject name", text: $name)
            PrimaryButton(title: "Create and add", style: .brand) {
                let n = name.trimmingCharacters(in: .whitespaces)
                if !n.isEmpty { done(.new(n)) }
            }
            if !existing.isEmpty {
                GroupHeading("Or one the school already has")
                VStack(spacing: 0) {
                    ForEach(Array(existing.enumerated()), id: \.element.id) { i, s in
                        Button { done(.existing(s)) } label: {
                            PlainLine(showsDivider: i < existing.count - 1) {
                                HStack { Text(s.name).font(.sc(.body, weight: .medium)).foregroundStyle(Tokens.text); Spacer()
                                    Image(systemName: "plus").foregroundStyle(Tokens.accent) }
                            }
                        }.buttonStyle(.pressable)
                    }
                }
            }
        }
        .fitSheetScroll()
    }
}
