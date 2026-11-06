import SwiftUI
import CryptoKit

/// Pictures that come from signed links. The links change every time they are asked for, so the picture is remembered by
/// what it is (an attachment id, or the logo's path), never by its link: in memory for the session, and as a file in the
/// Caches folder so it is still there next launch. A picture that is already known appears at once, with no reload flicker.
final class ImageStore: @unchecked Sendable {
    static let shared = ImageStore()

    private let memory: NSCache<NSString, UIImage> = {
        let c = NSCache<NSString, UIImage>()
        c.countLimit = 120
        return c
    }()
    private let folder: URL = {
        let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("krevo-images", isDirectory: true)
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        return base
    }()
    private let inflight = InflightLoads()

    private func file(_ key: String) -> URL {
        let digest = SHA256.hash(data: Data(key.utf8)).map { String(format: "%02x", $0) }.joined()
        return folder.appendingPathComponent(digest)
    }

    /// Instant lookup (memory, then disk). Safe to call while building a view.
    func cached(_ key: String) -> UIImage? {
        if let hit = memory.object(forKey: key as NSString) { return hit }
        guard let data = try? Data(contentsOf: file(key)), let image = UIImage(data: data) else { return nil }
        memory.setObject(image, forKey: key as NSString)
        return image
    }

    /// The picture for `key`, downloading it from the link `resolve` gives only if it is not already known. Two views asking
    /// for the same picture at once share one download.
    func image(key: String, resolve: @escaping @Sendable () async throws -> URL) async -> UIImage? {
        if let hit = cached(key) { return hit }
        let task = await inflight.task(for: key) { [self] in
            guard let url = try? await resolve(), let (data, response) = try? await URLSession.shared.data(from: url),
                  (response as? HTTPURLResponse).map({ (200..<300).contains($0.statusCode) }) ?? true,
                  let image = UIImage(data: data) else { return nil }
            memory.setObject(image, forKey: key as NSString)
            try? data.write(to: file(key), options: .atomic)
            return image
        }
        let result = await task.value
        await inflight.finish(key)
        return result
    }
}

private actor InflightLoads {
    private var tasks: [String: Task<UIImage?, Never>] = [:]

    func task(for key: String, make: @escaping @Sendable () async -> UIImage?) -> Task<UIImage?, Never> {
        if let running = tasks[key] { return running }
        let created = Task { await make() }
        tasks[key] = created
        return created
    }

    func finish(_ key: String) { tasks[key] = nil }
}

/// Fills its frame with a remembered picture. `key` says which picture it is; `resolve` gets a link only when it is needed.
struct CachedImage: View {
    let key: String
    let resolve: @Sendable () async throws -> URL
    var fit = false
    @State private var image: UIImage?

    init(key: String, fit: Bool = false, resolve: @escaping @Sendable () async throws -> URL) {
        self.key = key; self.fit = fit; self.resolve = resolve
        _image = State(initialValue: ImageStore.shared.cached(key))
    }

    var body: some View {
        ZStack {
            if let image {
                if fit { Image(uiImage: image).resizable().scaledToFit() } else { Image(uiImage: image).resizable().scaledToFill() }
            }
        }
        .task(id: key) {
            if image == nil { image = await ImageStore.shared.image(key: key, resolve: resolve) }
        }
    }
}
