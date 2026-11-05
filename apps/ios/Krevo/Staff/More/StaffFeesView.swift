import SwiftUI

/// Fee collection at a glance, and who owes what. Needs the fees permission (admins have it).
struct StaffFeesView: View {
    @Environment(StaffContext.self) private var context
    @State private var summary = Loader<FeesSummary>()
    @State private var query = ""
    @State private var dues = Loader<DuesPage>()

    var body: some View {
        ScreenScroll {
            TwoToneTitle(ink: "Fees", grey: "", role: .title1)
            LoadableView(summary.state, retry: { Task { await loadSummary() } }) { s in
                Card {
                    VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                        Text(rupees(s.collectedPaise)).font(.sc(.title2))
                        Text("collected of \(rupees(s.billedPaise)) billed" + (s.year.map { " · \($0)" } ?? "")).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                        ProgressView(value: min(100, s.collectionPercentage ?? 0), total: 100).tint(Tokens.accent).padding(.vertical, 4)
                        HStack {
                            VStack(alignment: .leading) { Text("Dues").font(.sc(.caption)).foregroundStyle(Tokens.textSecondary); Text(rupees(s.duesPaise)).font(.sc(.body, weight: .semibold)) }
                            Spacer()
                            VStack(alignment: .trailing) { Text("Overdue").font(.sc(.caption)).foregroundStyle(Tokens.textSecondary); Text(rupees(s.overduePaise)).font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.danger) }
                        }
                    }
                }
                if !s.topDuesClasses.isEmpty {
                    SectionLabel("Most dues")
                    ForEach(s.topDuesClasses.prefix(3)) { c in
                        Card { HStack { Text("Class \(c.classLabel)").font(.sc(.body, weight: .medium)); Spacer(); VStack(alignment: .trailing) { Text(rupees(c.duesPaise)).font(.sc(.callout, weight: .semibold)); Text("\(c.students) students").font(.sc(.caption)).foregroundStyle(Tokens.textSecondary) } } }
                    }
                }
            }

            SectionLabel("Students who owe fees")
            SearchField(prompt: "Search name or scholar number", text: $query)
            LoadableView(dues.state, retry: { Task { await loadDues() } }) { page in
                if page.items.isEmpty { EmptyNote(text: "No dues found.") }
                ForEach(page.items) { row in
                    Card {
                        HStack(spacing: Tokens.Space.s3) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(row.studentName).font(.sc(.body, weight: .medium))
                                Text([row.classLabel.map { "Class \($0)" }, row.guardianName].compactMap { $0 }.joined(separator: " · ")).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                                if row.overduePaise > 0 { Text("\(rupees(row.overduePaise)) overdue").font(.sc(.caption, weight: .semibold)).foregroundStyle(Tokens.danger) }
                            }
                            Spacer()
                            Text(rupees(row.duePaise)).font(.sc(.callout, weight: .semibold))
                            if let phone = row.guardianPhone { CallButton(phone: phone) }
                        }
                    }
                }
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadSummary() }
        .task(id: query) {
            if !query.isEmpty { try? await Task.sleep(for: .milliseconds(300)) }
            if !Task.isCancelled { await loadDues() }
        }
    }

    private func loadSummary() async { await summary.load { try await context.repo.feesSummary() } }
    private func loadDues() async { await dues.load { try await context.repo.dues(query: query, offset: 0) } }
}
