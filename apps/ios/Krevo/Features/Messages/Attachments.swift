import SwiftUI
import PhotosUI
import AVKit
import UniformTypeIdentifiers

/// A photo or video the person picked, ready to send. Photos are shrunk to a sensible size first.
struct PendingAttachment: Identifiable {
    let id = UUID()
    let data: Data
    let filename: String
    let contentType: String
    let preview: UIImage?
    var isVideo: Bool { contentType.hasPrefix("video/") }

    static let maxBytes = 50 * 1024 * 1024
}

/// A movie handed over by the photo picker as a file; copied somewhere we own so it can be read.
private struct PickedMovie: Transferable {
    let url: URL
    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(contentType: .movie) { movie in SentTransferredFile(movie.url) } importing: { received in
            let dir = FileManager.default.temporaryDirectory.appendingPathComponent("krevo-chat", isDirectory: true)
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            let copy = dir.appendingPathComponent(UUID().uuidString + "." + received.file.pathExtension)
            try FileManager.default.copyItem(at: received.file, to: copy)
            return PickedMovie(url: copy)
        }
    }
}

enum AttachmentPrep {
    static let tooLarge = "That video is too large. Please pick one under 50 MB."
    static let unreadable = "That file could not be opened."

    /// Turns a picker choice into something sendable, or throws a message the person can read.
    static func prepare(_ item: PhotosPickerItem) async throws -> PendingAttachment {
        if item.supportedContentTypes.contains(where: { $0.conforms(to: .movie) }) {
            guard let movie = try await item.loadTransferable(type: PickedMovie.self) else { throw ApiError(unreadable) }
            defer { try? FileManager.default.removeItem(at: movie.url) }
            let data = try Data(contentsOf: movie.url, options: .mappedIfSafe)
            guard data.count <= PendingAttachment.maxBytes else { throw ApiError(tooLarge) }
            let isMP4 = movie.url.pathExtension.lowercased() == "mp4"
            return PendingAttachment(data: data, filename: isMP4 ? "video.mp4" : "video.mov", contentType: isMP4 ? "video/mp4" : "video/quicktime",
                                     preview: await thumbnail(for: movie.url))
        }
        guard let raw = try await item.loadTransferable(type: Data.self), let image = UIImage(data: raw) else { throw ApiError(unreadable) }
        let small = image.scaled(maxSide: 2000)
        guard let jpeg = small.jpegData(compressionQuality: 0.8) else { throw ApiError(unreadable) }
        return PendingAttachment(data: jpeg, filename: "photo.jpg", contentType: "image/jpeg", preview: small.scaled(maxSide: 400))
    }

    private static func thumbnail(for url: URL) async -> UIImage? {
        let generator = AVAssetImageGenerator(asset: AVURLAsset(url: url))
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 400, height: 400)
        guard let cg = try? await generator.image(at: .zero).image else { return nil }
        return UIImage(cgImage: cg)
    }
}

private extension UIImage {
    func scaled(maxSide: CGFloat) -> UIImage {
        let longest = max(size.width, size.height)
        guard longest > maxSide else { return self }
        let ratio = maxSide / longest
        let target = CGSize(width: size.width * ratio, height: size.height * ratio)
        let format = UIGraphicsImageRendererFormat(); format.scale = 1
        return UIGraphicsImageRenderer(size: target, format: format).image { _ in draw(in: CGRect(origin: .zero, size: target)) }
    }
}

// MARK: - Composer

/// Message field with an attach button, a preview of what is attached, and send. Shared by parents and teachers.
struct ChatComposer: View {
    @Binding var draft: String
    @Binding var pending: PendingAttachment?
    let isSending: Bool
    let errorText: String?
    let canSend: Bool
    let placeholder: String
    let send: () -> Void
    let pick: (PhotosPickerItem) -> Void

    @State private var item: PhotosPickerItem?

    var body: some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s2) {
            if let errorText { Text(errorText).font(.sc(.caption)).foregroundStyle(Tokens.danger) }
            if let pending { preview(pending) }
            HStack(alignment: .bottom, spacing: Tokens.Space.s2) {
                PhotosPicker(selection: $item, matching: .any(of: [.images, .videos]), photoLibrary: .shared()) {
                    Image(systemName: "paperclip")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(Tokens.text)
                        .frame(width: Tokens.Control.md, height: Tokens.Control.md)
                        .background(Tokens.card, in: Circle())
                }
                .accessibilityLabel("Attach a photo or video")
                .disabled(isSending)
                .onChange(of: item) { _, new in
                    guard let new else { return }
                    pick(new)
                    item = nil
                }

                TextField(placeholder, text: $draft, axis: .vertical)
                    .font(.sc(.body))
                    .lineLimit(1...4)
                    .padding(.horizontal, Tokens.Space.s4)
                    .padding(.vertical, Tokens.Space.s3)
                    .background(Tokens.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))

                Button(action: send) {
                    Group {
                        if isSending { ProgressView().tint(Tokens.onAccent) }
                        else { Image(systemName: "arrow.up").font(.system(size: 17, weight: .bold)) }
                    }
                    .foregroundStyle(Tokens.onAccent)
                    .frame(width: Tokens.Control.md, height: Tokens.Control.md)
                    .background(Tokens.accent, in: Circle())
                }
                .buttonStyle(.pressable)
                .disabled(!canSend)
                .opacity(canSend || isSending ? 1 : 0.4)
                .accessibilityLabel("Send")
            }
        }
        .padding(.horizontal, Tokens.Space.s4)
        .padding(.vertical, Tokens.Space.s2)
        .background(Tokens.bg)
    }

    private func preview(_ file: PendingAttachment) -> some View {
        HStack(spacing: Tokens.Space.s3) {
            ZStack {
                if let image = file.preview { Image(uiImage: image).resizable().scaledToFill() }
                else { Tokens.fill }
                if file.isVideo { Image(systemName: "play.fill").foregroundStyle(.white).shadow(radius: 3) }
            }
            .frame(width: 56, height: 56)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(file.isVideo ? "Video" : "Photo").font(.sc(.callout, weight: .semibold))
                Text(ByteCountFormatter.string(fromByteCount: Int64(file.data.count), countStyle: .file)).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
            }
            Spacer()
            Button { pending = nil } label: {
                Image(systemName: "xmark").font(.system(size: 13, weight: .bold)).foregroundStyle(Tokens.textSecondary)
                    .frame(width: Tokens.Control.sm, height: Tokens.Control.sm).background(Tokens.fill, in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove attachment")
        }
        .padding(Tokens.Space.s2)
        .background(Tokens.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

// MARK: - Showing attachments in a bubble

/// One attachment inside a message: a photo you can open, a video tile that plays, or a file row.
struct AttachmentTile: View {
    let attachment: MessageAttachment
    let chat: ChatAPI

    @State private var url: URL?
    @State private var failed = false
    @State private var playing = false

    var body: some View {
        Group {
            if attachment.isImage { image } else if attachment.isVideo { video } else { file }
        }
        .task(id: attachment.id) {
            if attachment.isImage, url == nil { await resolve() }
        }
    }

    private var image: some View {
        Group {
            if let url {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFill()
                    case .failure: placeholder("photo")
                    default: Tokens.fill.overlay(ProgressView())
                    }
                }
            } else if failed { placeholder("photo") } else { Tokens.fill.overlay(ProgressView()) }
        }
        .frame(width: 220, height: 220)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var video: some View {
        Button { Task { if url == nil { await resolve() }; playing = url != nil } } label: {
            ZStack {
                Tokens.fill
                Image(systemName: "play.circle.fill").font(.system(size: 44)).foregroundStyle(Tokens.text.opacity(0.75))
            }
            .frame(width: 220, height: 140)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.pressable)
        .accessibilityLabel("Play video")
        .fullScreenCover(isPresented: $playing) {
            if let url { VideoPlayer(player: AVPlayer(url: url)).ignoresSafeArea() }
        }
    }

    private var file: some View {
        Button { Task { if url == nil { await resolve() }; if let url { await UIApplication.shared.open(url) } } } label: {
            HStack(spacing: Tokens.Space.s2) {
                Image(systemName: "doc.fill")
                Text(attachment.filename).font(.sc(.callout, weight: .medium)).lineLimit(1)
            }
            .foregroundStyle(Tokens.text)
            .padding(Tokens.Space.s3)
            .background(Tokens.fill, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.pressable)
    }

    private func placeholder(_ icon: String) -> some View { Tokens.fill.overlay(Image(systemName: icon).foregroundStyle(Tokens.textTertiary)) }

    private func resolve() async {
        do { url = try await chat.attachmentURL(id: attachment.id) } catch { failed = true }
    }
}
