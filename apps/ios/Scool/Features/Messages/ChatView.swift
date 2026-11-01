import SwiftUI

struct ChatView: View {
    let thread: MessageThread
    let canSend: Bool
    let childFirstName: String

    @Environment(Session.self) private var session
    @State private var vm = ChatViewModel()

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: Tokens.Space.s3) {
                    LoadableView(vm.messages, retry: { Task { await reload() } }) { list in
                        if list.isEmpty {
                            EmptyNote(text: "No messages yet. Say hello to \(thread.teacher).")
                        }
                        ForEach(list) { message in
                            Bubble(message: message).id(message.id)
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, Tokens.Space.s4)
            }
            .onChange(of: vm.messages.value?.count) {
                if let last = vm.messages.value?.last {
                    withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                }
            }
        }
        .background(Tokens.bg.ignoresSafeArea())
        .safeAreaInset(edge: .bottom, spacing: 0) { composer }
        .navigationTitle(thread.teacher)
        .navigationBarTitleDisplayMode(.inline)
        .task { await reload() }
    }

    private func reload() async {
        await vm.load(repo: session.repo, threadId: thread.id)
    }

    @ViewBuilder
    private var composer: some View {
        if canSend {
            VStack(alignment: .leading, spacing: Tokens.Space.s1) {
                if let message = vm.errorText {
                    Text(message).font(.sc(.caption)).foregroundStyle(Tokens.danger)
                }
                HStack(alignment: .bottom, spacing: Tokens.Space.s2) {
                    TextField("Message", text: $vm.draft, axis: .vertical)
                        .font(.sc(.body))
                        .lineLimit(1...4)
                        .padding(.horizontal, Tokens.Space.s4)
                        .padding(.vertical, Tokens.Space.s3)
                        .background(Tokens.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                    Button {
                        Task { await vm.send(repo: session.repo, threadId: thread.id) }
                    } label: {
                        Image(systemName: "arrow.up")
                            .font(.system(size: 17, weight: .bold))
                            .foregroundStyle(Tokens.onAccent)
                            .frame(width: Tokens.Control.md, height: Tokens.Control.md)
                            .background(Tokens.accent, in: Circle())
                    }
                    .buttonStyle(.plain)
                    .disabled(!vm.canSend)
                    .opacity(vm.canSend ? 1 : 0.4)
                    .accessibilityLabel("Send")
                }
            }
            .padding(.horizontal, Tokens.Space.s4)
            .padding(.vertical, Tokens.Space.s2)
            .background(Tokens.bg)
        } else {
            Text("\(childFirstName) has left school, so replies are turned off.")
                .font(.sc(.callout))
                .foregroundStyle(Tokens.textSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .padding(Tokens.Space.s4)
                .background(Tokens.bg)
        }
    }
}

private struct Bubble: View {
    let message: ChatMessage

    var body: some View {
        VStack(alignment: message.mine ? .trailing : .leading, spacing: 2) {
            Text(message.text)
                .font(.sc(.body))
                .foregroundStyle(message.mine ? Tokens.onSolid : Tokens.text)
                .padding(.horizontal, Tokens.Space.s4)
                .padding(.vertical, Tokens.Space.s3)
                .background(message.mine ? Tokens.solid : Tokens.card,
                            in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            Text(IST.dateTime(message.at))
                .font(.sc(.caption))
                .foregroundStyle(Tokens.textTertiary)
        }
        .frame(maxWidth: .infinity, alignment: message.mine ? .trailing : .leading)
        .accessibilityElement(children: .combine)
    }
}
