import SwiftUI
import PhotosUI

/// The Notices page: every notice, newest first, a page at a time. Tap one to open it. People who may write
/// (whole school with the Announcements permission, or the classes they teach) get a compose button, and can attach photos.
struct StaffAnnouncementsView: View {
    @Environment(StaffContext.self) private var context
    @Environment(NoticeReads.self) private var reads
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
        .task(id: reads.changes) { await reload() }
        .sheet(isPresented: $composing) {
            StaffComposeView { _ in composing = false; Task { await reload() } }
        }
    }

    private func row(_ b: Broadcast, last: Bool) -> some View {
        NoticeCard(notice: b, height: 190)
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
    @State private var notice: Broadcast
    @Environment(StaffContext.self) private var context
    @Environment(NoticeReads.self) private var reads
    @Environment(\.dismiss) private var dismiss
    @State private var editing = false
    @State private var confirmDelete = false
    @State private var failure: String?

    init(notice: Broadcast) { _notice = State(initialValue: notice) }

    var body: some View {
        content
            .onAppear { reads.markRead(notice.id) }
            .toolbar {
                if notice.canEdit == true {
                    ToolbarItem(placement: .topBarTrailing) {
                        Menu {
                            Button { editing = true } label: { Label("Edit", systemImage: "pencil") }
                            Button(role: .destructive) { confirmDelete = true } label: { Label("Delete", systemImage: "trash") }
                        } label: { Image(systemName: "ellipsis") }
                            .accessibilityLabel("Notice options")
                    }
                }
            }
            .sheet(isPresented: $editing) {
                StaffComposeView(editing: notice) { updated in
                    notice = updated; editing = false; reads.noticesChanged()
                }
            }
            .confirmationDialog("Delete this notice?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) { Task { await delete() } }
                Button("Cancel", role: .cancel) {}
            } message: { Text("Parents will no longer see it.") }
    }

    private func delete() async {
        do {
            try await context.repo.deleteBroadcast(id: notice.id)
            reads.noticesChanged(); Haptics.success(); dismiss()
        } catch { failure = (error as? ApiError)?.message ?? "That could not be deleted. Try again."; Haptics.error() }
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
            if let failure { Text(failure).font(.sc(.callout)).foregroundStyle(Tokens.danger) }
        }
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// Write a notice: to the whole school (Announcements permission) or a class you teach, with up to five photos.
struct StaffComposeView: View {
    /// Set to edit an existing notice: its title, text and photos (the audience cannot change).
    var editing: Broadcast?
    let sent: (Broadcast) -> Void
    @Environment(StaffContext.self) private var context
    @State private var title = ""
    @State private var text = ""
    @State private var target = ""   // "" = whole school, else a class id
    @State private var picked: [PhotosPickerItem] = []
    @State private var photos: [PendingAttachment] = []
    @State private var kept: [BroadcastFile] = []
    @State private var seeded = false
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
            Text(editing == nil ? "New notice" : "Edit notice").font(.sc(.title2))
            if editing == nil {
                SectionLabel("To")
                ChipRow(options: options, selection: $target)
            }
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
            PrimaryButton(title: editing == nil ? "Send" : "Save", style: .brand, isLoading: busy) { Task { await send() } }
        }
        .onAppear {
            if let e = editing, !seeded { title = e.title; text = e.body; kept = e.attachments ?? []; seeded = true }
            if editing == nil, options.first(where: { $0.id == target }) == nil, let first = options.first { target = first.id }
        }
        .onChange(of: picked) { _, items in Task { await load(items) } }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private var photosSection: some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s2) {
            if !photos.isEmpty || !kept.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Tokens.Space.s2) {
                        ForEach(kept, id: \.id) { f in
                            ZStack(alignment: .topTrailing) {
                                KeptPhoto(file: f).frame(width: 84, height: 84)
                                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                Button { kept.removeAll { $0.id == f.id } } label: {
                                    Image(systemName: "xmark.circle.fill").font(.system(size: 20)).foregroundStyle(.white, .black.opacity(0.65))
                                }.padding(4).accessibilityLabel("Remove photo")
                            }
                        }
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
            if photos.count + kept.count < 5 {
                PhotosPicker(selection: $picked, maxSelectionCount: 5 - photos.count - kept.count, matching: .images) {
                    Label(photos.isEmpty && kept.isEmpty ? "Add photos" : "Add more", systemImage: "photo.badge.plus")
                        .font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.text)
                        .padding(.horizontal, 16).frame(minHeight: 42).background(Tokens.card, in: Capsule())
                }
            }
        }
    }

    private func load(_ items: [PhotosPickerItem]) async {
        for item in items where photos.count + kept.count < 5 {
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
            var ids: [String] = kept.map(\.id)
            for p in photos { ids.append(try await context.chat.upload(p)) }
            if let e = editing {
                sent(try await context.repo.editBroadcast(id: e.id, title: t, body: b, attachmentIds: ids))
                return
            }
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

    /// Bumped when a notice is edited or deleted, so lists showing notices reload.
    private(set) var changes = 0
    func noticesChanged() { changes += 1 }

    func isNew(_ id: String) -> Bool { !ids.contains(id) }

    func markRead(_ id: String) {
        guard !ids.contains(id) else { return }
        ids.insert(id)
        UserDefaults.standard.set(Array(ids.suffix(500)), forKey: key)
    }
}

/// A notice as one card with just text at the bottom: a small title and the date under it. Plain grey with dark text; with a photo
/// the photo fills the card under a black layer and the text turns white. A "New" chip shows until it has been opened.
struct NoticeCard: View {
    let notice: Broadcast
    var height: CGFloat = 170
    @Environment(StaffContext.self) private var context
    @Environment(NoticeReads.self) private var reads
    @State private var photo: URL?

    private var photoId: String? { notice.attachments?.first(where: { $0.contentType.hasPrefix("image/") })?.id }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            Tokens.card
            if let photo {
                // The picture fills the card but never widens it: it is laid over an empty view of the card's size.
                Color.clear.overlay {
                    AsyncImage(url: photo) { phase in
                        if case .success(let image) = phase { image.resizable().scaledToFill() }
                    }
                }
                .clipped()
            }
            if photoId != nil {
                LinearGradient(colors: [.black.opacity(0.25), .black.opacity(0.55), .black.opacity(0.85)], startPoint: .top, endPoint: .bottom)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(notice.title).font(.sc(.callout, weight: .semibold)).foregroundStyle(photoId != nil ? .white : Tokens.text)
                    .lineLimit(2).multilineTextAlignment(.leading)
                Text(IST.dateTime(notice.createdAt)).font(.sc(.caption)).foregroundStyle(photoId != nil ? .white.opacity(0.7) : Tokens.textSecondary)
            }
            .padding(Tokens.Space.s4)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .overlay(alignment: .topTrailing) {
            if reads.isNew(notice.id) {
                Text("New").font(.sc(.caption, weight: .bold)).foregroundStyle(Tokens.onAccent)
                    .padding(.horizontal, 10).frame(minHeight: 24)
                    .background(Tokens.accent, in: Capsule())
                    .padding(Tokens.Space.s3)
            }
        }
        .frame(maxWidth: .infinity).frame(height: height)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .task(id: photoId) {
            guard let id = photoId else { photo = nil; return }
            photo = try? await context.chat.attachmentURL(id: id)
        }
    }
}

/// A photo already on a notice, as a small square.
private struct KeptPhoto: View {
    let file: BroadcastFile
    @Environment(StaffContext.self) private var context
    @State private var url: URL?

    var body: some View {
        ZStack {
            Tokens.fill
            if let url {
                AsyncImage(url: url) { phase in
                    if case .success(let image) = phase { image.resizable().scaledToFill() }
                }
            }
        }
        .task { url = try? await context.chat.attachmentURL(id: file.id) }
    }
}
