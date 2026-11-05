import UIKit

/// Light physical feedback for the moments that matter. All calls are safe to make anywhere on the main thread.
@MainActor
enum Haptics {
    /// A choice changed (filter chip, attendance mark, tab).
    static func select() { UISelectionFeedbackGenerator().selectionChanged() }
    /// Something was saved or sent.
    static func success() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    /// Something went wrong.
    static func error() { UINotificationFeedbackGenerator().notificationOccurred(.error) }
    /// A soft tap for pressing a button.
    static func tap() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
}
