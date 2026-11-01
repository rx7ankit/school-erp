import Foundation
import Observation

@Observable
@MainActor
final class ChatViewModel {
    var messages: Loadable<[ChatMessage]> = .loading
    var draft = ""
    var isSending = false
    var errorText: String?

    var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSending
    }

    func load(repo: any Repository, threadId: String) async {
        messages = await Loadable<[ChatMessage]>.capture { try await repo.messages(threadId: threadId) }
    }

    func send(repo: any Repository, threadId: String) async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        isSending = true
        errorText = nil
        do {
            let sent = try await repo.send(threadId: threadId, text: text)
            var list = messages.value ?? []
            list.append(sent)
            messages = .loaded(list)
            draft = ""
        } catch {
            errorText = error.localizedDescription
        }
        isSending = false
    }
}
