import SwiftUI

struct MessagesView: View {
    let child: Child

    @Environment(Session.self) private var session
    @State private var vm = MessagesViewModel()

    var body: some View {
        NavigationStack {
            ScreenScroll {
                TwoToneTitle(ink: L.t("msgs.ink"), grey: L.f("msgs.grey", child.firstName), role: .title1)

                Picker(L.t("msgs.picker"), selection: $vm.mode) {
                    ForEach(MessagesViewModel.Mode.allCases) { mode in
                        Text(mode.title).tag(mode)
                    }
                }
                .pickerStyle(.segmented)

                switch vm.mode {
                case .classFeed:
                    classFeed
                case .personal:
                    personal
                }
            }
            .refreshable { await reload() }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: MessageThread.self) { thread in
                ChatView(thread: thread, canSend: !child.hasLeft, childFirstName: child.firstName)
            }
        }
        .task { await reload() }
    }

    private func reload() async {
        await vm.load(repo: session.repo, childId: child.id)
    }

    // MARK: Class broadcasts

    @ViewBuilder
    private var classFeed: some View {
        LoadableView(vm.broadcasts, retry: { Task { await reload() } }) { list in
            SubjectChips(subjects: vm.subjects(in: list), selection: $vm.subjectFilter)
            let items = vm.filtered(list)
            if items.isEmpty {
                EmptyNote(text: L.t("msgs.empty_class"))
            }
            ForEach(items) { item in
                BroadcastCard(item: item)
            }
        }
    }

    // MARK: Personal threads

    @ViewBuilder
    private var personal: some View {
        if child.hasLeft {
            Card {
                Text(L.f("msgs.left", child.firstName))
                    .font(.sc(.callout))
                    .foregroundStyle(Tokens.textSecondary)
            }
        }
        LoadableView(vm.threads, retry: { Task { await reload() } }) { list in
            if list.isEmpty {
                EmptyNote(text: L.t("msgs.empty_personal"))
            }
            ForEach(list) { thread in
                NavigationLink(value: thread) {
                    ThreadRow(thread: thread)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

private struct SubjectChips: View {
    let subjects: [String]
    @Binding var selection: String?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Tokens.Space.s2) {
                chip(L.t("msgs.all"), isOn: selection == nil) { selection = nil }
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

private struct BroadcastCard: View {
    let item: Broadcast

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                HStack {
                    Pill(text: L.known("subject", item.subject), tone: .accent)
                    Spacer()
                    Text(IST.dateTime(item.at))
                        .font(.sc(.caption))
                        .foregroundStyle(Tokens.textTertiary)
                }
                Text(item.teacher)
                    .font(.sc(.callout, weight: .semibold))
                    .foregroundStyle(Tokens.text)
                Text(item.text)
                    .font(.sc(.body))
                    .foregroundStyle(Tokens.text)
                if let file = item.attachment {
                    Pill(text: file, tone: .neutral, systemImage: "paperclip")
                }
            }
        }
    }
}

private struct ThreadRow: View {
    let thread: MessageThread

    var body: some View {
        Card {
            HStack(spacing: Tokens.Space.s3) {
                Avatar(name: thread.teacher, size: 44)
                VStack(alignment: .leading, spacing: 2) {
                    Text(thread.teacher).font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.text)
                    Text(L.known("role", thread.role)).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
                    Text(thread.lastText.isEmpty ? L.t("msgs.no_messages") : thread.lastText)
                        .font(.sc(.callout))
                        .foregroundStyle(Tokens.textSecondary)
                        .lineLimit(1)
                }
                Spacer()
                if !thread.lastAt.isEmpty {
                    Text(IST.time(thread.lastAt))
                        .font(.sc(.caption))
                        .foregroundStyle(Tokens.textTertiary)
                }
            }
        }
    }
}
