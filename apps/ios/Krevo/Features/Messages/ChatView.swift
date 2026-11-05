import SwiftUI
import PhotosUI

struct ChatView: View {
    let thread: TeacherThread
    let child: Child

    /// Only an active thread of a child who is still at school has a composer.
    private var canSend: Bool { thread.isActive && !child.hasLeft }

    @Environment(Session.self) private var session
    @State private var vm = ChatViewModel()
    private var chat: ChatAPI { ChatAPI(api: session.api, isParent: true) }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: Tokens.Space.s3) {
                    LoadableView(vm.messages, retry: { Task { await reload() } }, skeleton: {
                        VStack(spacing: Tokens.Space.s3) {
                            chatBubble(width: 210, mine: false)
                            chatBubble(width: 150, mine: true)
                            chatBubble(width: 250, mine: false)
                            chatBubble(width: 120, mine: true)
                        }
                    }) { list in
                        if list.isEmpty {
                            EmptyNote(text: L.f("chat.empty", thread.teacher))
                        }
                        ForEach(list) { message in
                            ChatBubble(message: message, chat: chat).id(message.id)
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
        // A chat has its own back button, so the tab bar steps out of the way.
        .toolbar(.hidden, for: .tabBar)
        .task { await reload() }
    }

    /// Placeholder chat bubble: same corner radius and padding as `Bubble`, plus the time line.
    private func chatBubble(width: CGFloat, mine: Bool) -> some View {
        VStack(alignment: mine ? .trailing : .leading, spacing: 2) {
            SkeletonBlock(width: width, height: Tokens.Space.s3 * 2 + 22, radius: 20)
            SkeletonLine(width: 90, role: .caption)
        }
        .frame(maxWidth: .infinity, alignment: mine ? .trailing : .leading)
    }

    /// Why the composer is missing.
    private var readOnlyText: String {
        if !thread.isActive {
            let subject = L.known("subject", thread.subject)
            return L.f("msgs.readonly_inactive", thread.teacher, subject, child.firstName)
        }
        return L.f("chat.left", child.firstName)
    }

    private func reload() async {
        await vm.load(chat: chat, threadId: thread.id)
    }

    @ViewBuilder
    private var composer: some View {
        if canSend {
            ChatComposer(draft: $vm.draft, pending: $vm.pending, isSending: vm.isSending, errorText: vm.errorText, canSend: vm.canSend,
                         placeholder: L.t("chat.placeholder"),
                         send: { Task { await vm.send(chat: chat, threadId: thread.id) } },
                         pick: { vm.attach($0) })
        } else {
            Text(readOnlyText)
                .font(.sc(.callout))
                .foregroundStyle(Tokens.textSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .padding(Tokens.Space.s4)
                .background(Tokens.bg)
        }
    }
}

/// One message: its photos, videos and files, then the text, then the time. Shared by parents and teachers.
struct ChatBubble: View {
    let message: ThreadMessage
    let chat: ChatAPI

    var body: some View {
        VStack(alignment: message.mine ? .trailing : .leading, spacing: 2) {
            ForEach(message.attachments) { AttachmentTile(attachment: $0, chat: chat) }
            if !message.text.isEmpty {
                Text(message.text)
                    .font(.sc(.body))
                    .foregroundStyle(message.mine ? Tokens.onSolid : Tokens.text)
                    .padding(.horizontal, Tokens.Space.s4)
                    .padding(.vertical, Tokens.Space.s3)
                    .background(message.mine ? Tokens.solid : Tokens.card,
                                in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            }
            Text(IST.dateTime(message.at))
                .font(.sc(.caption))
                .foregroundStyle(Tokens.textTertiary)
        }
        .frame(maxWidth: .infinity, alignment: message.mine ? .trailing : .leading)
        .accessibilityElement(children: .combine)
    }
}
