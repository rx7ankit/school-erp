import SwiftUI

/// Start a conversation with a child's parents: pick the student, and the conversation opens. A teacher can write about
/// children in the classes they teach; the server refuses anyone else and its message is shown here.
struct StaffNewConversationView: View {
    let opened: (StaffThread) -> Void

    @Environment(StaffContext.self) private var context
    @State private var query = ""
    @State private var items: [StudentItem] = []
    @State private var total = 0
    @State private var loading = true
    @State private var loadingMore = false
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        ScreenScroll {
            Text("New conversation").font(.sc(.title2))
            Text("Pick a student to message their parents.").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
            SearchField(prompt: "Search name or scholar number", text: $query)
            if let error { Text(error).font(.sc(.callout)).foregroundStyle(Tokens.danger) }
            if loading && items.isEmpty {
                ProgressView().frame(maxWidth: .infinity).padding(.vertical, Tokens.Space.s5)
            } else if items.isEmpty {
                EmptyNote(text: "No students found.")
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(items.enumerated()), id: \.element.id) { i, s in
                        Button { Task { await start(s) } } label: {
                            PlainRow(title: s.name,
                                     subtitle: [s.classLabel.map { "Class \($0)" }, s.rollNo.map { "Roll \($0)" }].compactMap { $0 }.joined(separator: " · "),
                                     showsChevron: false, showsDivider: i < items.count - 1, inset: 52) {
                                Avatar(name: s.name, size: 40)
                            }
                        }
                        .buttonStyle(.pressable)
                        .disabled(busy)
                        .task { if s.id == items.last?.id { await more() } }
                    }
                    if loadingMore { ProgressView().frame(maxWidth: .infinity).padding() }
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .task(id: query) {
            if !query.isEmpty { try? await Task.sleep(for: .milliseconds(300)) }
            if Task.isCancelled { return }
            await reload()
        }
    }

    private func reload() async {
        do {
            let page = try await context.repo.students(query: query, classId: nil, offset: 0)
            items = page.items; total = page.total
        } catch { if !(error is CancellationError) { items = [] } }
        loading = false
    }

    private func more() async {
        guard !loadingMore, items.count < total else { return }
        loadingMore = true
        if let page = try? await context.repo.students(query: query, classId: nil, offset: items.count) {
            items += page.items.filter { new in !items.contains { $0.id == new.id } }
        }
        loadingMore = false
    }

    /// The conversation is as class teacher when I am the class teacher of the child's class, else about my subject there.
    private func subjectId(for student: StudentItem) -> String? {
        guard let label = student.classLabel, let cls = context.classes.first(where: { $0.label == label }) else { return nil }
        let mine = context.me.assignments.filter { $0.classId == cls.id }
        if mine.contains(where: { $0.role == "class_teacher" }) { return nil }
        return mine.first?.subjectId
    }

    private func start(_ student: StudentItem) async {
        busy = true; error = nil
        defer { busy = false }
        do {
            opened(try await context.repo.openThread(studentId: student.id, subjectId: subjectId(for: student)))
        } catch {
            self.error = (error as? ApiError)?.message ?? "That conversation could not be started."
        }
    }
}
