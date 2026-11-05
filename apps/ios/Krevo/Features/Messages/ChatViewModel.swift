import Foundation
import Observation
import PhotosUI
import SwiftUI

@Observable
@MainActor
final class ChatViewModel {
    var messages: Loadable<[ThreadMessage]> = .loading
    var draft = ""
    var isSending = false
    var errorText: String?

    var pending: PendingAttachment?

    /// Text, an attachment, or both.
    var canSend: Bool {
        let hasText = !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        return (hasText || pending != nil) && !isSending
    }

    func load(chat: ChatAPI, threadId: String) async {
        messages = await Loadable<[ThreadMessage]>.capture { try await chat.messages(threadId: threadId) }
    }

    func attach(_ item: PhotosPickerItem) {
        errorText = nil
        Task {
            do { pending = try await AttachmentPrep.prepare(item) }
            catch { errorText = error.localizedDescription }
        }
    }

    func send(chat: ChatAPI, threadId: String) async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty || pending != nil else { return }
        isSending = true
        errorText = nil
        do {
            var ids: [String] = []
            if let file = pending { ids.append(try await chat.upload(file)) }
            let sent = try await chat.send(threadId: threadId, text: text, attachmentIds: ids)
            var list = messages.value ?? []
            list.append(sent)
            messages = .loaded(list)
            draft = ""
            pending = nil
            Haptics.success()
        } catch {
            errorText = error.localizedDescription
            Haptics.error()
        }
        isSending = false
    }
}
