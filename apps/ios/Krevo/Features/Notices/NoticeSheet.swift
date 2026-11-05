import SwiftUI

/// One notice, in the shape both the Home slider and the Messages list can show: a school notice or a class update.
struct NoticeDetail: Identifiable, Hashable {
    let id: String
    let title: String
    let sender: String
    let tag: String
    let body: String
    let at: String
    let attachment: String?
    var isRead = true

    init(_ n: Notice) {
        id = n.id; title = n.title; sender = ""; tag = ""; body = n.body; at = n.publishedAt; attachment = nil
    }

    init(_ u: Update) {
        id = u.id
        title = u.title.isEmpty ? String(u.text.prefix(60)) : u.title
        sender = u.sender; tag = u.tag; body = u.text; at = u.at; attachment = u.attachment; isRead = u.isRead
    }
}

/// The full notice in a bottom sheet: who sent it, when, and everything it says.
struct NoticeSheet: View {
    let notice: NoticeDetail

    var body: some View {
        ScreenScroll {
            VStack(alignment: .leading, spacing: Tokens.Space.s3) {
                HStack(spacing: Tokens.Space.s2) {
                    if !notice.tag.isEmpty { Pill(text: L.known("subject", notice.tag)) }
                    Text(IST.dateTime(notice.at)).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
                }
                Text(notice.title).font(.sc(.title2)).foregroundStyle(Tokens.text).fixedSize(horizontal: false, vertical: true)
                if !notice.sender.isEmpty {
                    Text(L.f("notice.from", notice.sender)).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                }
                Text(notice.body).font(.sc(.body)).foregroundStyle(Tokens.text).fixedSize(horizontal: false, vertical: true)
                if let file = notice.attachment {
                    Pill(text: file, systemImage: "paperclip")
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}
