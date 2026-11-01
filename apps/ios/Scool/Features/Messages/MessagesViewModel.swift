import Foundation
import Observation

@Observable
@MainActor
final class MessagesViewModel {
    enum Mode: String, CaseIterable, Identifiable {
        case classFeed, personal
        var id: String { rawValue }
        var title: String { self == .classFeed ? L.t("msgs.class") : L.t("msgs.personal") }
    }

    var mode: Mode = .classFeed
    var subjectFilter: String?          // nil = all subjects
    var broadcasts: Loadable<[Broadcast]> = .loading
    var threads: Loadable<[MessageThread]> = .loading

    func load(repo: any Repository, childId: String) async {
        async let b = Loadable<[Broadcast]>.capture { try await repo.broadcasts(childId: childId) }
        async let t = Loadable<[MessageThread]>.capture { try await repo.threads(childId: childId) }
        broadcasts = await b
        threads = await t
    }

    func subjects(in list: [Broadcast]) -> [String] {
        var seen: [String] = []
        for item in list where !seen.contains(item.subject) {
            seen.append(item.subject)
        }
        return seen
    }

    func filtered(_ list: [Broadcast]) -> [Broadcast] {
        let sorted = list.sorted { $0.at > $1.at }
        guard let subject = subjectFilter else { return sorted }
        return sorted.filter { $0.subject == subject }
    }
}
