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
                VStack(spacing: 0) {
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
        PlainLine(showsDivider: !last) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top) {
                    Text(b.title).font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.text).lineLimit(2).multilineTextAlignment(.leading)
                    Spacer(minLength: Tokens.Space.s2)
                    Pill(text: b.scope == "school" ? "Whole school" : "Class \(b.classLabel ?? "")")
                }
                Text(b.body).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary).lineLimit(2).multilineTextAlignment(.leading)
                HStack(spacing: 6) {
                    if let n = b.attachments?.count, n > 0 {
                        Image(systemName: "photo").font(.system(size: 12)).foregroundStyle(Tokens.textTertiary)
                        Text("\(n)").font(.sc(.caption)).foregroundStyle(Tokens.textTertiary)
                    }
                    Text("\(b.senderName) · \(IST.dateTime(b.createdAt))").font(.sc(.caption)).foregroundStyle(Tokens.textTertiary)
                }
            }
        }
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

    var body: some View {
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
