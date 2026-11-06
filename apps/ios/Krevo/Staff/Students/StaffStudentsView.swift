import SwiftUI

struct StaffStudentsView: View {
    /// Inside another screen's navigation (the Academic hub, or pushed from Home): show a back button and a small title.
    var embedded = false

    @Environment(StaffContext.self) private var context
    @State private var query = ""
    @State private var classId = ""
    @State private var items: [StudentItem] = []
    @State private var total = 0
    @State private var state: Loadable<Void> = .idle
    @State private var loadingMore = false

    var body: some View {
        StackIf(embedded: embedded) {
            ScreenScroll {
                SearchField(prompt: "Search name or scholar number", text: $query)
                if context.classes.count > 1 {
                    ChipRow(options: [(id: "", title: "All")] + context.classes.map { (id: $0.id, title: $0.label) }, selection: $classId)
                }

                switch state {
                case .idle, .loading where items.isEmpty:
                    VStack(spacing: 0) { ForEach(0..<6, id: \.self) { _ in HStack(spacing: Tokens.Space.s3) { SkeletonBlock(width: 40, height: 40, radius: 20); VStack(alignment: .leading, spacing: 6) { SkeletonLine(width: 140, role: .body); SkeletonLine(width: 90, role: .caption) } ; Spacer() }.padding(.vertical, 14) } }
                case .failed(let message) where items.isEmpty:
                    Text(message).font(.sc(.callout)).foregroundStyle(Tokens.danger)
                    Button("Try again") { Task { await reload() } }.font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.text)
                default:
                    if items.isEmpty { EmptyNote(text: "No students found.") }
                    VStack(spacing: 0) {
                        ForEach(items) { student in
                            NavigationLink(value: student) { row(student, last: student.id == items.last?.id) }
                                .buttonStyle(.pressable)
                                .task { if student.id == items.last?.id { await more() } }
                        }
                    }
                    if loadingMore { ProgressView().frame(maxWidth: .infinity) }
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .refreshable { await reload() }
            .toolbar(embedded ? .automatic : .hidden, for: .navigationBar)
            .navigationTitle(embedded ? "Students" : "")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: StudentItem.self) { StaffStudentDetailView(item: $0).hidesTabBar() }
            .task(id: query + "|" + classId) {
                // Wait a moment while typing, so each keystroke is not a request.
                if !query.isEmpty { try? await Task.sleep(for: .milliseconds(300)) }
                if Task.isCancelled { return }
                await reload()
            }
        }
    }

    private func row(_ s: StudentItem, last: Bool) -> some View {
        PlainRow(title: s.name,
                 subtitle: [s.classLabel.map { "Class \($0)" }, s.rollNo.map { "Roll \($0)" }].compactMap { $0 }.joined(separator: " · "),
                 showsDivider: !last, inset: 52) {
            Avatar(name: s.name, size: 40)
        }
    }

    private func reload() async {
        if items.isEmpty { state = .loading }
        do {
            let page = try await context.repo.students(query: query, classId: classId.isEmpty ? nil : classId, offset: 0)
            items = page.items
            total = page.total
            state = .loaded(())
        } catch {
            if !(error is CancellationError) { state = .failed(error.localizedDescription) }
        }
    }

    private func more() async {
        guard !loadingMore, items.count < total else { return }
        loadingMore = true
        if let page = try? await context.repo.students(query: query, classId: classId.isEmpty ? nil : classId, offset: items.count) {
            items += page.items.filter { new in !items.contains { $0.id == new.id } }
        }
        loadingMore = false
    }
}

struct StaffStudentDetailView: View {
    let item: StudentItem
    @Environment(StaffContext.self) private var context
    @State private var detail = Loader<StudentDetail>()

    var body: some View {
        ScreenScroll {
            HStack(spacing: Tokens.Space.s3) {
                Avatar(name: item.name, size: 56)
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.name).font(.sc(.title3)).fixedSize(horizontal: false, vertical: true)
                    Text([item.classLabel.map { "Class \($0)" }, item.scholarNo].compactMap { $0 }.joined(separator: " · ")).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                }
            }
            LoadableView(detail.state, retry: { Task { await load() } }) { d in
                GroupHeading("Student")
                VStack(spacing: 0) {
                    let facts: [(String, String)] = [
                        ("Scholar no.", d.scholarNo),
                        d.currentEnrollment?.rollNo.map { ("Roll no.", String($0)) },
                        d.gender.map { ("Gender", $0.capitalized) },
                        d.dob.map { ("Born", IST.date($0)) },
                        d.bloodGroup.map { ("Blood group", $0) },
                        d.category.map { ("Category", $0) },
                        d.admittedOn.map { ("Admitted", IST.date($0)) },
                        (d.address?.isEmpty == false) ? ("Address", d.address ?? "") : nil,
                        (d.medicalNotes?.isEmpty == false) ? ("Medical notes", d.medicalNotes ?? "") : nil,
                    ].compactMap { $0 }
                    ForEach(Array(facts.enumerated()), id: \.offset) { i, f in
                        InfoRow(label: f.0, value: f.1)
                            .padding(.vertical, 12)
                            .overlay(alignment: .bottom) { if i < facts.count - 1 { Separator() } }
                    }
                }

                GroupHeading("Family")
                VStack(spacing: 0) {
                    ForEach(Array(d.guardians.enumerated()), id: \.element.id) { i, g in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(g.name).font(.sc(.body, weight: .medium))
                                Text(g.relation.capitalized + (g.isPrimary ? " · Primary" : "") + (g.occupation.map { " · \($0)" } ?? "")).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                                if let phone = g.phone { Text(phone).font(.sc(.callout)).foregroundStyle(Tokens.text) }
                            }
                            Spacer()
                            if let phone = g.phone { CallButton(phone: phone) }
                        }
                        .padding(.vertical, 14)
                        .overlay(alignment: .bottom) { if i < d.guardians.count - 1 || d.emergencyPhone != nil { Separator() } }
                    }
                    if let name = d.emergencyName, let phone = d.emergencyPhone {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Emergency contact").font(.sc(.caption, weight: .semibold)).foregroundStyle(Tokens.textSecondary)
                                Text(name).font(.sc(.body, weight: .medium))
                            }
                            Spacer()
                            CallButton(phone: phone)
                        }
                        .padding(.vertical, 14)
                    }
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async { await detail.load { try await context.repo.student(id: item.id) } }
}
