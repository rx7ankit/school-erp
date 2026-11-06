import SwiftUI
import PhotosUI
import UIKit

/// A round picture from a link, or the person's initials until there is one.
struct RemoteAvatar: View {
    let url: String?
    let initials: String
    var size: CGFloat = 40

    var body: some View {
        ZStack {
            Tokens.solid
            Text(initials).font(.system(size: size * 0.38, weight: .bold)).foregroundStyle(Tokens.onSolid)
            if let url, let link = URL(string: url) {
                AsyncImage(url: link) { phase in
                    if case .success(let image) = phase { image.resizable().scaledToFill() }
                }
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .accessibilityHidden(true)
    }
}

/// The school's logo, or its first letters on a soft orange tile until the admin uploads one.
struct SchoolMark: View {
    let logoUrl: String?
    let name: String
    var size: CGFloat = 44

    private var initials: String { name.split(separator: " ").prefix(2).compactMap { $0.first }.map(String.init).joined().uppercased() }

    var body: some View {
        ZStack {
            Tokens.accentSubtle
            Text(initials).font(.system(size: size * 0.36, weight: .bold)).foregroundStyle(Tokens.accent)
            if let logoUrl, let link = URL(string: logoUrl) {
                AsyncImage(url: link) { phase in
                    if case .success(let image) = phase { image.resizable().scaledToFit().padding(4).background(Tokens.bg) }
                }
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: size * 0.28, style: .continuous))
        .accessibilityHidden(true)
    }
}

/// The popup behind the round picture at the top right: who is signed in, their role, and the controls for their photo.
struct StaffProfileSheet: View {
    @Environment(StaffContext.self) private var context
    @Environment(Session.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var picked: PhotosPickerItem?
    @State private var isSaving = false
    @State private var errorText: String?

    private var me: StaffMe { context.me }
    private var initials: String { me.name.split(separator: " ").prefix(2).compactMap { $0.first }.map(String.init).joined().uppercased() }

    var body: some View {
        VStack(spacing: Tokens.Space.s4) {
            PhotosPicker(selection: $picked, matching: .images) {
                ZStack(alignment: .bottomTrailing) {
                    RemoteAvatar(url: me.photoUrl, initials: initials, size: 96)
                    Image(systemName: isSaving ? "hourglass" : "camera.fill")
                        .font(.system(size: 13, weight: .bold)).foregroundStyle(Tokens.onAccent)
                        .frame(width: 30, height: 30).background(Tokens.accent, in: Circle())
                        .overlay(Circle().stroke(Tokens.bg, lineWidth: 2))
                }
            }
            .disabled(isSaving)
            .accessibilityLabel("Change your photo")

            VStack(spacing: 6) {
                Text(me.name).font(.sc(.title2)).foregroundStyle(Tokens.text)
                Text(me.email).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                HStack(spacing: Tokens.Space.s2) {
                    Text(context.access.roleTitle).font(.sc(.caption, weight: .semibold))
                        .foregroundStyle(context.access.isAdmin ? Tokens.onSolid : Tokens.text)
                        .padding(.horizontal, 12).frame(minHeight: 28)
                        .background(context.access.isAdmin ? Tokens.solid : Tokens.fill, in: Capsule())
                    if let school = me.school { Pill(text: school.name) }
                }
                .padding(.top, 2)
            }

            if let errorText { Text(errorText).font(.sc(.callout)).foregroundStyle(Tokens.danger).multilineTextAlignment(.center) }

            VStack(spacing: Tokens.Space.s2) {
                if me.photoUrl != nil {
                    Button("Remove photo") { Task { await save(nil) } }
                        .font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.textSecondary)
                        .disabled(isSaving)
                }
                PrimaryButton(title: "Sign out", style: .solid) { dismiss(); session.signOut() }
            }
            .padding(.top, Tokens.Space.s2)
        }
        .padding(.horizontal, 24)
        .padding(.top, Tokens.Space.s6)
        .padding(.bottom, Tokens.Space.s4)
        .frame(maxWidth: .infinity)
        .fitSheet()
        .presentationCornerRadius(32)
        .presentationBackground(.regularMaterial)
        .onChange(of: picked) { _, item in
            guard let item else { return }
            Task {
                defer { picked = nil }
                guard let data = try? await item.loadTransferable(type: Data.self), let jpeg = Self.jpeg(from: data) else {
                    errorText = "That picture could not be read."
                    return
                }
                await save(jpeg)
            }
        }
    }

    private func save(_ jpeg: Data?) async {
        isSaving = true; errorText = nil
        defer { isSaving = false }
        do { try await context.setPhoto(jpeg: jpeg) }
        catch { errorText = (error as? ApiError)?.message ?? "The photo could not be saved. Try again." }
    }

    /// A square-ish JPEG no bigger than 800 pixels on the long side, so the upload is small and under the server's limit.
    static func jpeg(from data: Data) -> Data? {
        guard let image = UIImage(data: data) else { return nil }
        let longest = max(image.size.width, image.size.height)
        let scale = min(1, 800 / longest)
        let target = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let format = UIGraphicsImageRendererFormat(); format.scale = 1
        let resized = UIGraphicsImageRenderer(size: target, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: target)) }
        return resized.jpegData(compressionQuality: 0.82)
    }
}
