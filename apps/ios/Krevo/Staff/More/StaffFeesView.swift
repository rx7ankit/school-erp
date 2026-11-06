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
                VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                    Text(rupees(s.collectedPaise)).font(.sc(.title1)).foregroundStyle(Tokens.text)
                    Text("collected of \(rupees(s.billedPaise)) billed" + (s.year.map { " · \($0)" } ?? "")).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                    BrandProgress(fraction: (s.collectionPercentage ?? 0) / 100).padding(.vertical, 6)
                }
                VStack(spacing: 0) {
                    PlainLine { InfoRow(label: "Dues", value: rupees(s.duesPaise)) }
                    PlainLine(showsDivider: false) {
                        HStack { Text("Overdue").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary); Spacer(); Text(rupees(s.overduePaise)).font(.sc(.callout, weight: .medium)).foregroundStyle(Tokens.danger) }
                    }
                }
                if !s.topDuesClasses.isEmpty {
                    GroupHeading("Most dues")
                    PlainList(items: Array(s.topDuesClasses.prefix(3))) { c, last in
                        PlainLine(showsDivider: !last) {
                            HStack {
                                Text("Class \(c.classLabel)").font(.sc(.body, weight: .medium)).foregroundStyle(Tokens.text)
                                Spacer()
                                VStack(alignment: .trailing, spacing: 2) {
                                    Text(rupees(c.duesPaise)).font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.text)
                                    Text("\(c.students) students").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                                }
                            }
                        }
                    }
                }
            }

            GroupHeading("Students who owe fees")
            SearchField(prompt: "Search name or scholar number", text: $query)
            LoadableView(dues.state, retry: { Task { await loadDues() } }) { page in
                if page.items.isEmpty { EmptyNote(text: "No dues found.") }
                PlainList(items: page.items) { row, last in
                    PlainLine(showsDivider: !last) {
                        HStack(spacing: Tokens.Space.s3) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(row.studentName).font(.sc(.body, weight: .medium)).foregroundStyle(Tokens.text)
                                Text([row.classLabel.map { "Class \($0)" }, row.guardianName].compactMap { $0 }.joined(separator: " · ")).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                                if row.overduePaise > 0 { Text("\(rupees(row.overduePaise)) overdue").font(.sc(.callout, weight: .medium)).foregroundStyle(Tokens.danger) }
                            }
                            Spacer()
                            Text(rupees(row.duePaise)).font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.text)
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
