import SwiftUI

/// Parent conversations. Pick one to read it and reply, with photos or videos if needed.
struct StaffMessagesView: View {
    /// As the Messages tab: no big heading, no navigation bar.
    var isRoot = false
    @Environment(StaffContext.self) private var context
    @State private var list = Loader<[StaffThread]>()

    var body: some View {
        ScreenScroll {
            if !isRoot { TwoToneTitle(ink: "Messages", grey: "", role: .title1) }
            LoadableView(list.state, retry: { Task { await load() } }) { rows in
                if rows.isEmpty { EmptyNote(text: "No conversations yet.", systemImage: "bubble.left.and.bubble.right") }
                PlainList(items: rows) { t, last in
                    NavigationLink(value: t) { row(t, last: last) }.buttonStyle(.pressable)
                }
            }
        }
        .refreshable { await load() }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(isRoot ? .hidden : .automatic, for: .navigationBar)
        .navigationDestination(for: StaffThread.self) { StaffChatView(thread: $0) }
        .task { await load() }
    }

    private func row(_ t: StaffThread, last: Bool) -> some View {
        PlainRow(title: t.studentName + (t.classLabel.map { " · \($0)" } ?? ""), subtitle: t.lastMessagePreview ?? "No messages yet",
                 showsDivider: !last, inset: 56,
                 accessory: t.unread > 0 ? AnyView(
                    Text("\(t.unread)").font(.sc(.caption, weight: .bold)).foregroundStyle(Tokens.onAccent)
                        .frame(minWidth: 22, minHeight: 22).background(Tokens.accent, in: Capsule())
                 ) : nil) {
            Avatar(name: t.studentName, size: 44)
        }
    }

    private func load() async { await list.load { try await context.repo.threads() } }
}

struct StaffChatView: View {
    let thread: StaffThread
    @Environment(StaffContext.self) private var context
    @State private var vm = ChatViewModel()

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: Tokens.Space.s3) {
                    LoadableView(vm.messages, retry: { Task { await reload() } }) { list in
                        if list.isEmpty { EmptyNote(text: "No messages yet.") }
                        ForEach(list) { ChatBubble(message: $0, chat: context.chat).id($0.id) }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, Tokens.Space.s4)
            }
            .onChange(of: vm.messages.value?.count) {
                if let last = vm.messages.value?.last { withAnimation { proxy.scrollTo(last.id, anchor: .bottom) } }
            }
        }
        .background(Tokens.bg.ignoresSafeArea())
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if thread.active {
                ChatComposer(draft: $vm.draft, pending: $vm.pending, isSending: vm.isSending, errorText: vm.errorText, canSend: vm.canSend,
                             placeholder: "Message", send: { Task { await vm.send(chat: context.chat, threadId: thread.id) } }, pick: { vm.attach($0) })
            } else {
                Text("This conversation is closed.").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                    .frame(maxWidth: .infinity).padding(Tokens.Space.s4).background(Tokens.bg)
            }
        }
        .navigationTitle(thread.studentName)
        .navigationBarTitleDisplayMode(.inline)
        // A chat has its own back button, so the tab bar steps out of the way.
        .toolbar(.hidden, for: .tabBar)
        .task { await reload() }
    }

    private func reload() async { await vm.load(chat: context.chat, threadId: thread.id) }
}

/// The Messages tab: parent conversations.
struct StaffMessagesTab: View {
    var body: some View {
        NavigationStack { StaffMessagesView(isRoot: true) }
    }
}
