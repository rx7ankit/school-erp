import SwiftUI

/// The unified Updates feed: school and class broadcasts, newest first. Read-only, no replies.
struct UpdatesView: View {
    let child: Child

    @Environment(Session.self) private var session
    @State private var vm = UpdatesViewModel()

    var body: some View {
        ScreenScroll {
            TwoToneTitle(ink: L.t("updates.ink"), grey: L.t("updates.grey"), role: .title1)

            LoadableView(vm.updates, retry: { Task { await reload() } }) { list in
                FilterChips(subjects: vm.subjects(in: list), selection: $vm.filter)
                let items = vm.filtered(list)
                if items.isEmpty {
                    EmptyNote(text: L.t("msgs.no_updates"))
                }
                ForEach(items) { item in
                    UpdateCard(item: item)
                }
            }
        }
        .refreshable { await reload() }
        .navigationBarTitleDisplayMode(.inline)
        .task { await reload() }
        // Unread markers stay visible while reading; everything is marked read on leaving.
        .onDisappear {
            let repo = session.repo
            let childId = child.id
            Task { try? await repo.markUpdatesRead(childId: childId) }
        }
    }

    private func reload() async {
        await vm.load(repo: session.repo, childId: child.id)
    }
}

/// All, School, then each subject present.
private struct FilterChips: View {
    let subjects: [String]
    @Binding var selection: String?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Tokens.Space.s2) {
                chip(L.t("msgs.all"), isOn: selection == nil) { selection = nil }
                chip(L.t("subject.school"), isOn: selection == Update.schoolTag) { selection = Update.schoolTag }
                ForEach(subjects, id: \.self) { subject in
                    chip(L.known("subject", subject), isOn: selection == subject) { selection = subject }
                }
            }
        }
    }

    private func chip(_ title: String, isOn: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.sc(.callout, weight: .semibold))
                .foregroundStyle(isOn ? Tokens.onSolid : Tokens.text)
                .padding(.horizontal, Tokens.Space.s4)
                .frame(minHeight: Tokens.Control.md)
                .background(isOn ? Tokens.solid : Tokens.card, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isOn ? .isSelected : [])
    }
}

private struct UpdateCard: View {
    let item: Update

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                HStack(spacing: Tokens.Space.s2) {
                    Text(item.sender)
                        .font(.sc(.callout, weight: .semibold))
                        .foregroundStyle(Tokens.text)
                    if !item.isRead {
                        Circle().fill(Tokens.accent).frame(width: 8, height: 8)
                            .accessibilityHidden(true)
                    }
                    Spacer()
                    Pill(text: L.known("subject", item.tag))
                }
                Text(item.text)
                    .font(.sc(.body))
                    .foregroundStyle(Tokens.text)
                if let file = item.attachment {
                    Pill(text: file, tone: .neutral, systemImage: "paperclip")
                }
                Text(IST.dateTime(item.at))
                    .font(.sc(.caption))
                    .foregroundStyle(Tokens.textTertiary)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityValue(item.isRead ? "" : L.t("msgs.unread"))
    }
}
