import SwiftUI

/// A horizontally scrolling row whose left and right edges fade out softly. Each edge only fades while there is more to
/// scroll that way: at the very start the left edge is crisp, at the very end the right edge is.
private struct HorizontalEdgeFade: ViewModifier {
    var width: CGFloat = 8
    @State private var offset: CGFloat = 0
    @State private var content: CGFloat = 0
    @State private var viewport: CGFloat = 0

    @ViewBuilder
    func body(content view: Content) -> some View {
        if #available(iOS 18, *) {
            faded(view.onScrollGeometryChange(for: [CGFloat].self) { g in
                [g.contentOffset.x, g.contentSize.width, g.containerSize.width]
            } action: { _, v in
                offset = v[0]; content = v[1]; viewport = v[2]
            })
        } else {
            // Before iOS 18 the scroll position cannot be read: the right edge fades, the left stays crisp.
            faded(view)
        }
    }

    private func faded<V: View>(_ view: V) -> some View {
        view
            .mask {
                HStack(spacing: 0) {
                    LinearGradient(colors: [.black.opacity(leftOpacity), .black], startPoint: .leading, endPoint: .trailing).frame(width: width)
                    Rectangle().fill(.black)
                    LinearGradient(colors: [.black, .black.opacity(rightOpacity)], startPoint: .leading, endPoint: .trailing).frame(width: width)
                }
            }
    }

    /// The left edge stays crisp: only the right edge, where the next card slides in, fades.
    private var leftOpacity: Double { 1 }
    private var rightOpacity: Double { viewport == 0 || content - offset - viewport > 2 ? 0 : 1 }
}

extension View {
    /// Soft fade at the left and right edges of a horizontal scroll view, only where more content lies beyond.
    func horizontalEdgeFade() -> some View { modifier(HorizontalEdgeFade()) }
}
