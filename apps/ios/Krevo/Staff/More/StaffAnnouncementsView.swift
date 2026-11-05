import SwiftUI

/// Announcements sent to parents. Admins can send to the whole school; every teacher can send to a class they teach.
struct StaffAnnouncementsView: View {
    @Environment(StaffContext.self) private var context
    @State private var list = Loader<[Broadcast]>()
    @State private var composing = false

    var body: some View {
        ScreenScroll {
            TwoToneTitle(ink: "Announcements", grey: "", role: .title1)
            PrimaryButton(title: "New announcement", style: .brand) { composing = true }
            LoadableView(list.state, retry: { Task { await load() } }) { rows in
                if rows.isEmpty { EmptyNote(text: "Nothing sent yet.") }
                ForEach(rows) { b in
                    Card {
                        VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                            HStack {
                                Text(b.title).font(.sc(.body, weight: .semibold))
                                Spacer()
                                Pill(text: b.scope == "school" ? "Whole school" : "Class \(b.classLabel ?? "")")
                            }
                            Text(b.body).font(.sc(.callout)).foregroundStyle(Tokens.text).lineLimit(4)
                            Text("\(b.senderName) · \(IST.dateTime(b.createdAt)) · read by \(b.readCount) of \(b.recipientCount)")
                                .font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
                        }
                    }
                }
            }
        }
        .refreshable { await load() }
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .sheet(isPresented: $composing) {
            StaffComposeView { _ in composing = false; Task { await load() } }
                .sheetPadding()
                .presentationDragIndicator(.visible)
        }
    }

    private func load() async { await list.load { try await context.repo.broadcasts() } }
}

private struct StaffComposeView: View {
    let sent: (Broadcast) -> Void
    @Environment(StaffContext.self) private var context
    @State private var title = ""
    @State private var text = ""
    @State private var target = ""   // "" = whole school, else a class id
    @State private var busy = false
    @State private var error: String?

    private var options: [(id: String, title: String)] {
        var list: [(id: String, title: String)] = []
        if context.access.isAdmin { list.append((id: "", title: "Whole school")) }
        let classes = context.access.isAdmin ? context.classes : context.classes.filter { c in context.me.assignments.contains { $0.classId == c.id } }
        list += classes.map { (id: $0.id, title: "Class \($0.label)") }
        return list
    }

    var body: some View {
        ScreenScroll {
            Text("New announcement").font(.sc(.title2))
            SectionLabel("To")
            ChipRow(options: options, selection: $target)
            AppField(title: "Title", text: $title)
            VStack(alignment: .leading, spacing: 6) {
                Text("Message").font(.sc(.caption, weight: .semibold)).foregroundStyle(Tokens.textSecondary)
                TextEditor(text: $text)
                    .font(.sc(.body))
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 140)
                    .padding(Tokens.Space.s3)
                    .background(Tokens.card, in: RoundedRectangle(cornerRadius: Tokens.Radius.control, style: .continuous))
            }
            if let error { Text(error).font(.sc(.callout)).foregroundStyle(Tokens.danger) }
            PrimaryButton(title: "Send", style: .brand, isLoading: busy) { Task { await send() } }
        }
        .onAppear { if options.first(where: { $0.id == target }) == nil, let first = options.first { target = first.id } }
        .presentationDetents([.large])
    }

    private func send() async {
        let t = title.trimmingCharacters(in: .whitespacesAndNewlines), b = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty, !b.isEmpty else { error = "Add a title and a message."; return }
        busy = true; error = nil
        do {
            let draft = BroadcastDraft(title: t, body: b, scope: target.isEmpty ? "school" : "class", audience: "all", classId: target.isEmpty ? nil : target)
            sent(try await context.repo.postBroadcast(draft))
        } catch { self.error = error.localizedDescription }
        busy = false
    }
}
