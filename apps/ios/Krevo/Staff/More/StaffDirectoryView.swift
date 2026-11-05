import SwiftUI

/// Everyone on the staff. Needs the staff permission (admins have it).
struct StaffDirectoryView: View {
    @Environment(StaffContext.self) private var context
    @State private var query = ""
    @State private var list = Loader<[StaffMember]>()

    var body: some View {
        ScreenScroll {
            TwoToneTitle(ink: "Staff.", grey: "Your team.", role: .title1)
            SearchField(prompt: "Search by name", text: $query)
            LoadableView(list.state, retry: { Task { await load() } }) { rows in
                if rows.isEmpty { EmptyNote(text: "No one found.") }
                ForEach(rows) { m in
                    Card {
                        HStack(spacing: Tokens.Space.s3) {
                            Avatar(name: m.name, size: 40)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(m.name).font(.sc(.body, weight: .medium))
                                Text([m.designation, m.department].filter { !$0.isEmpty }.joined(separator: " · ")).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                            }
                            Spacer()
                            if m.isAdmin { Pill(text: "Admin", tone: .accent) }
                            if let phone = m.phone, !phone.isEmpty { CallButton(phone: phone) }
                        }
                    }
                }
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: query) {
            if !query.isEmpty { try? await Task.sleep(for: .milliseconds(300)) }
            if !Task.isCancelled { await load() }
        }
    }

    private func load() async { await list.load { try await context.repo.staff(query: query) } }
}
