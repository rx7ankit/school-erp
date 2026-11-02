import Foundation
import Observation

/// Carries "open this screen for that child" requests (notification taps, push payloads)
/// to the tab bar, which owns the selected child and the selected tab.
@Observable
@MainActor
final class Router {
    struct Request: Equatable {
        let id = UUID()
        let link: DeepLink
        let childId: String?
    }

    var request: Request?
    /// Set by the tab bar for More to push; More clears it when used.
    var moreRoute: MoreView.Route?

    func open(_ link: DeepLink, childId: String?) {
        request = Request(link: link, childId: childId)
    }
}
