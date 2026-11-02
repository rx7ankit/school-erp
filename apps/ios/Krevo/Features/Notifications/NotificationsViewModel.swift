import Foundation
import Observation

@Observable
@MainActor
final class NotificationsViewModel {
    var items: Loadable<[AppNotification]> = .loading
    /// false = only the selected child, true = every child (others get a name tag).
    var showAll = false

    func load(repo: any Repository, childIds: [String]) async {
        let result = await Loadable<[AppNotification]>.capture { try await repo.notifications(childIds: childIds) }
        if let list = result.value {
            items = .loaded(list.sorted { $0.at > $1.at })
        } else {
            items = result
        }
    }

    /// Newest first, only the categories switched on in Settings.
    func visible(_ list: [AppNotification], childId: String) -> [AppNotification] {
        list.filter { $0.category.isEnabled && (showAll || $0.childId == childId) }
    }

    func markAllRead(repo: any Repository, childIds: [String]) async {
        try? await repo.markAllRead(childIds: childIds)
        if var list = items.value {
            for index in list.indices { list[index].isRead = true }
            items = .loaded(list)
        }
    }
}
