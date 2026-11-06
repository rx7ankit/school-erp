import SwiftUI
import PhotosUI

/// The Notices page: every notice, newest first, a page at a time. Tap one to open it. People who may write
/// (whole school with the Announcements permission, or the classes they teach) get a compose button, and can attach photos.
struct StaffAnnouncementsView: View {
    @Environment(StaffContext.self) private var context
    @State private var items: [Broadcast] = []
    @State private var total = 0
    @State private var loading = true
    @State private var loadingMore = false
    @State private var failure: String?
    @State private var composing = false

    private var canCompose: Bool { context.access.canAnnounce || !context.me.assignments.isEmpty }

    var body: some View {
        ScreenScroll {
            if loading && items.isEmpty {
                VStack(spacing: 0) {
                    ForEach(0..<4, id: \.self) { _ in
                        VStack(alignment: .leading, spacing: 8) { SkeletonLine(width: 200, role: .body); SkeletonLine(role: .callout); SkeletonLine(width: 140, role: .caption) }
                            .padding(.vertical, 14).frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            } else if let failure, items.isEmpty {
                Text(failure).font(.sc(.callout)).foregroundStyle(Tokens.danger)
                Button("Try again") { Task { await reload() } }.font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.text)
            } else if items.isEmpty {
                EmptyNote(text: "No notices yet.", systemImage: "megaphone")
            } else {
                VStack(spacing: Tokens.Space.s3) {
                    ForEach(Array(items.enumerated()), id: \.element.id) { i, b in
                        NavigationLink(value: b) { row(b, last: i == items.count - 1) }
                            .buttonStyle(.pressable)
                            .task { if b.id == items.last?.id { await more() } }
                    }
                    if loadingMore { ProgressView().frame(maxWidth: .infinity).padding() }
                }
            }
        }
        .refreshable { await reload() }
        .navigationTitle("Notices")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            if canCompose {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { composing = true } label: { Image(systemName: "square.and.pencil") }.accessibilityLabel("New notice")
                }
            }
        }
        .navigationDestination(for: Broadcast.self) { StaffNoticeDetailView(notice: $0).hidesTabBar() }
        .task { await reload() }
        .sheet(isPresented: $composing) {
            StaffComposeView { _ in composing = false; Task { await reload() } }
        }
    }

    private func row(_ b: Broadcast, last: Bool) -> some View {
        NoticeCard(notice: b, height: 200)
    }

    private func reload() async {
        do {
            let page = try await context.repo.broadcastPage(offset: 0)
            items = page.items; total = page.total; failure = nil
        } catch { if !(error is CancellationError) { failure = error.localizedDescription } }
        loading = false
    }

    private func more() async {
        guard !loadingMore, items.count < total else { return }
        loadingMore = true
        if let page = try? await context.repo.broadcastPage(offset: items.count) {
            items += page.items.filter { new in !items.contains { $0.id == new.id } }
        }
        loadingMore = false
    }
}

/// One notice: the full text, its photos, who sent it and how many parents have read it.
struct StaffNoticeDetailView: View {
    let notice: Broadcast
    @Environment(StaffContext.self) private var context
    @Environment(NoticeReads.self) private var reads

    var body: some View {
        content.onAppear { reads.markRead(notice.id) }
    }

    private var content: some View {
        ScreenScroll {
            Text(notice.title).font(.sc(.title2)).foregroundStyle(Tokens.text).fixedSize(horizontal: false, vertical: true)
            HStack(spacing: Tokens.Space.s2) {
                Pill(text: notice.scope == "school" ? "Whole school" : "Class \(notice.classLabel ?? "")")
                Text("\(notice.senderName) · \(IST.dateTime(notice.createdAt))").font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
            }
            Text(notice.body).font(.sc(.body)).foregroundStyle(Tokens.text).fixedSize(horizontal: false, vertical: true)
            ForEach(notice.attachments ?? [], id: \.id) { f in
                AttachmentTile(attachment: MessageAttachment(id: f.id, filename: f.filename, contentType: f.contentType, sizeBytes: f.sizeBytes), chat: context.chat)
            }
            PlainLine(showsDivider: false) {
                InfoRow(label: "Read by", value: "\(notice.readCount) of \(notice.recipientCount)")
            }
        }
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// Write a notice: to the whole school (Announcements permission) or a class you teach, with up to five photos.
private struct StaffComposeView: View {
    let sent: (Broadcast) -> Void
    @Environment(StaffContext.self) private var context
    @State private var title = ""
    @State private var text = ""
    @State private var target = ""   // "" = whole school, else a class id
    @State private var picked: [PhotosPickerItem] = []
    @State private var photos: [PendingAttachment] = []
    @State private var busy = false
    @State private var error: String?

    private var options: [(id: String, title: String)] {
        var list: [(id: String, title: String)] = []
        // Announcements can write to the whole school and any class; everyone else only to the classes they teach.
        if context.access.canAnnounce { list.append((id: "", title: "Whole school")) }
        let classes = context.access.canAnnounce ? context.classes : context.classes.filter { c in context.me.assignments.contains { $0.classId == c.id } }
        list += classes.map { (id: $0.id, title: "Class \($0.label)") }
        return list
    }

    var body: some View {
        ScreenScroll {
            Text("New notice").font(.sc(.title2))
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
            photosSection
            if let error { Text(error).font(.sc(.callout)).foregroundStyle(Tokens.danger) }
            PrimaryButton(title: "Send", style: .brand, isLoading: busy) { Task { await send() } }
        }
        .onAppear { if options.first(where: { $0.id == target }) == nil, let first = options.first { target = first.id } }
        .onChange(of: picked) { _, items in Task { await load(items) } }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private var photosSection: some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s2) {
            if !photos.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Tokens.Space.s2) {
                        ForEach(photos) { p in
                            ZStack(alignment: .topTrailing) {
                                if let img = p.preview {
                                    Image(uiImage: img).resizable().scaledToFill().frame(width: 84, height: 84)
                                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                } else {
                                    RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Tokens.fill).frame(width: 84, height: 84)
                                }
                                Button { photos.removeAll { $0.id == p.id } } label: {
                                    Image(systemName: "xmark.circle.fill").font(.system(size: 20)).foregroundStyle(.white, .black.opacity(0.65))
                                }.padding(4).accessibilityLabel("Remove photo")
                            }
                        }
                    }
                }
            }
            if photos.count < 5 {
                PhotosPicker(selection: $picked, maxSelectionCount: 5 - photos.count, matching: .images) {
                    Label(photos.isEmpty ? "Add photos" : "Add more", systemImage: "photo.badge.plus")
                        .font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.text)
                        .padding(.horizontal, 16).frame(minHeight: 42).background(Tokens.card, in: Capsule())
                }
            }
        }
    }

    private func load(_ items: [PhotosPickerItem]) async {
        for item in items where photos.count < 5 {
            if let p = try? await AttachmentPrep.prepare(item) { photos.append(p) }
        }
        picked = []
    }

    private func send() async {
        let t = title.trimmingCharacters(in: .whitespacesAndNewlines), b = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty, !b.isEmpty else { error = "Add a title and a message."; return }
        busy = true; error = nil
        defer { busy = false }
        do {
            var ids: [String] = []
            for p in photos { ids.append(try await context.chat.upload(p)) }
            let draft = BroadcastDraft(title: t, body: b, scope: target.isEmpty ? "school" : "class", audience: "all", classId: target.isEmpty ? nil : target, attachmentIds: ids)
            sent(try await context.repo.postBroadcast(draft))
        } catch { self.error = (error as? ApiError)?.message ?? error.localizedDescription }
    }
}


/// Which notices this person has opened on this device. A notice is "New" until it is opened once.
@Observable
@MainActor
final class NoticeReads {
    private var ids: Set<String>
    private let key: String

    init(userId: String) {
        key = "krevo.noticeReads.\(userId)"
        ids = Set(UserDefaults.standard.stringArray(forKey: key) ?? [])
    }

    func isNew(_ id: String) -> Bool { !ids.contains(id) }

    func markRead(_ id: String) {
        guard !ids.contains(id) else { return }
        ids.insert(id)
        UserDefaults.standard.set(Array(ids.suffix(500)), forKey: key)
    }
}

/// A notice as a card: its photo first (dark slate when it has none), a dark layer over the bottom carrying the title and
/// date, and a "New" chip until it has been opened.
struct NoticeCard: View {
    let notice: Broadcast
    var height: CGFloat = 200
    @Environment(StaffContext.self) private var context
    @Environment(NoticeReads.self) private var reads
    @State private var photo: URL?

    private var photoId: String? { notice.attachments?.first(where: { $0.contentType.hasPrefix("image/") })?.id }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(colors: [Color(red: 0.22, green: 0.23, blue: 0.26), Color(red: 0.13, green: 0.14, blue: 0.16)], startPoint: .topLeading, endPoint: .bottomTrailing)
            if let photo {
                AsyncImage(url: photo) { phase in
                    if case .success(let image) = phase { image.resizable().scaledToFill() }
                }
            }
            LinearGradient(colors: [.clear, .black.opacity(0.45), .black.opacity(0.85)], startPoint: .init(x: 0.5, y: 0.35), endPoint: .bottom)
            VStack(alignment: .leading, spacing: 3) {
                Text(notice.title).font(.sc(.title3)).foregroundStyle(.white).lineLimit(2).multilineTextAlignment(.leading)
                Text(IST.dateTime(notice.createdAt)).font(.sc(.caption)).foregroundStyle(.white.opacity(0.7))
            }
            .padding(Tokens.Space.s4)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .overlay(alignment: .topLeading) {
            if reads.isNew(notice.id) {
                Text("New").font(.sc(.caption, weight: .bold)).foregroundStyle(Tokens.onAccent)
                    .padding(.horizontal, 10).frame(minHeight: 24)
                    .background(Tokens.accent, in: Capsule())
                    .padding(Tokens.Space.s3)
            }
        }
        .frame(maxWidth: .infinity).frame(height: height)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .task(id: photoId) {
            guard let id = photoId else { photo = nil; return }
            photo = try? await context.chat.attachmentURL(id: id)
        }
    }
}
