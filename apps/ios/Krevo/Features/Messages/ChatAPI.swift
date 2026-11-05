import Foundation

/// The chat endpoints, for parents (`/parent/...`) and for teachers (`/messaging/...`). Both sides share the same
/// screen, so the only difference lives here.
struct ChatAPI: Sendable {
    let api: APIClient
    let isParent: Bool

    private var threads: String { isParent ? "/parent/threads" : "/messaging/threads" }
    private var uploadPath: String { isParent ? "/parent/messaging/upload-url" : "/files/upload-url" }
    private var filePrefix: String { isParent ? "/parent/messaging/files" : "/messaging/files" }
    private var completePrefix: String { isParent ? "/parent/messaging/files" : "/files" }

    /// Oldest first. Opening a thread marks it read.
    func messages(threadId: String) async throws -> [ThreadMessage] {
        let page: StaffPage<MessageDTO> = try await api.get("\(threads)/\(threadId)/messages", query: ["limit": "100"])
        try? await api.sendVoid("POST", "\(threads)/\(threadId)/read")
        return page.items.sorted { $0.createdAt < $1.createdAt }.map(\.model)
    }

    func send(threadId: String, text: String, attachmentIds: [String]) async throws -> ThreadMessage {
        struct Body: Encodable { let body: String; let attachmentIds: [String] }
        let m: MessageDTO = try await api.send("POST", "\(threads)/\(threadId)/messages", body: Body(body: text, attachmentIds: attachmentIds))
        return m.model
    }

    /// Three steps: ask for an upload link, send the bytes, tell the server it arrived. Returns the file id.
    func upload(_ file: PendingAttachment) async throws -> String {
        struct Ask: Encodable { let purpose: String; let filename: String; let contentType: String; let sizeBytes: Int }
        struct Link: Decodable { let id: String; let uploadUrl: String; let headers: [String: String] }
        let link: Link = try await api.send("POST", uploadPath, body: Ask(purpose: "message_attachment", filename: file.filename, contentType: file.contentType, sizeBytes: file.data.count))
        try await api.upload(to: link.uploadUrl, data: file.data, headers: link.headers)
        try await api.sendVoid("POST", "\(completePrefix)/\(link.id)/complete")
        return link.id
    }

    /// A short-lived link to view the file.
    func attachmentURL(id: String) async throws -> URL {
        struct Out: Decodable { let url: String }
        let out: Out = try await api.get("\(filePrefix)/\(id)/url")
        guard let url = URL(string: out.url) else { throw ApiError("The file link is not valid.") }
        return url
    }
}
