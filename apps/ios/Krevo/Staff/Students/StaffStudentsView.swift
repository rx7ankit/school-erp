import SwiftUI

struct StaffStudentsView: View {
    @Environment(StaffContext.self) private var context
    @State private var query = ""
    @State private var classId = ""
    @State private var items: [StudentItem] = []
    @State private var total = 0
    @State private var state: Loadable<Void> = .idle
    @State private var loadingMore = false

    var body: some View {
        NavigationStack {
            ScreenScroll {
                StaffHeader(ink: "Students.", grey: total > 0 ? "\(total) in all." : "")
                SearchField(prompt: "Search name or scholar number", text: $query)
                if context.classes.count > 1 {
                    ChipRow(options: [(id: "", title: "All")] + context.classes.map { (id: $0.id, title: $0.label) }, selection: $classId)
                }

                switch state {
                case .idle, .loading where items.isEmpty:
                    VStack(spacing: Tokens.Space.s3) { ForEach(0..<5, id: \.self) { _ in SkeletonCard { HStack { SkeletonBlock(width: 38, height: 38, radius: 19); VStack(alignment: .leading, spacing: 6) { SkeletonLine(width: 140, role: .body); SkeletonLine(width: 90, role: .caption) } } } } }
                case .failed(let message) where items.isEmpty:
                    Text(message).font(.sc(.callout)).foregroundStyle(Tokens.danger)
                    Button("Try again") { Task { await reload() } }.font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.text)
                default:
                    if items.isEmpty { EmptyNote(text: "No students found.") }
                    ForEach(items) { student in
                        NavigationLink(value: student) { row(student) }
                            .buttonStyle(.pressable)
                            .task { if student.id == items.last?.id { await more() } }
                    }
                    if loadingMore { ProgressView().frame(maxWidth: .infinity) }
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .refreshable { await reload() }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: StudentItem.self) { StaffStudentDetailView(item: $0) }
            .task(id: query + "|" + classId) {
                // Wait a moment while typing, so each keystroke is not a request.
                if !query.isEmpty { try? await Task.sleep(for: .milliseconds(300)) }
                if Task.isCancelled { return }
                await reload()
            }
        }
    }

    private func row(_ s: StudentItem) -> some View {
        Card {
            HStack(spacing: Tokens.Space.s3) {
                Avatar(name: s.name, size: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(s.name).font(.sc(.body, weight: .medium)).foregroundStyle(Tokens.text).lineLimit(1)
                    Text([s.classLabel.map { "Class \($0)" }, s.rollNo.map { "Roll \($0)" }].compactMap { $0 }.joined(separator: " · "))
                        .font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Tokens.textTertiary)
            }
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
                SectionLabel("Student")
                Card {
                    VStack(spacing: Tokens.Space.s3) {
                        InfoRow(label: "Scholar no.", value: d.scholarNo)
                        if let roll = d.currentEnrollment?.rollNo { InfoRow(label: "Roll no.", value: String(roll)) }
                        if let g = d.gender { InfoRow(label: "Gender", value: g.capitalized) }
                        if let dob = d.dob { InfoRow(label: "Born", value: IST.date(dob)) }
                        if let b = d.bloodGroup { InfoRow(label: "Blood group", value: b) }
                        if let c = d.category { InfoRow(label: "Category", value: c) }
                        if let a = d.admittedOn { InfoRow(label: "Admitted", value: IST.date(a)) }
                    }
                }
                if let a = d.address, !a.isEmpty { Card { InfoRow(label: "Address", value: a) } }
                if let notes = d.medicalNotes, !notes.isEmpty { Card { InfoRow(label: "Medical notes", value: notes) } }

                SectionLabel("Family")
                ForEach(d.guardians) { g in
                    Card {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(g.name).font(.sc(.body, weight: .medium))
                                Text(g.relation.capitalized + (g.isPrimary ? " · Primary" : "") + (g.occupation.map { " · \($0)" } ?? "")).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                                if let phone = g.phone { Text(phone).font(.sc(.callout)).foregroundStyle(Tokens.text) }
                            }
                            Spacer()
                            if let phone = g.phone { CallButton(phone: phone) }
                        }
                    }
                }
                if let name = d.emergencyName, let phone = d.emergencyPhone {
                    Card { HStack { VStack(alignment: .leading, spacing: 2) { Text("Emergency contact").font(.sc(.caption, weight: .semibold)).foregroundStyle(Tokens.textSecondary); Text(name).font(.sc(.body, weight: .medium)) }; Spacer(); CallButton(phone: phone) } }
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async { await detail.load { try await context.repo.student(id: item.id) } }
}
