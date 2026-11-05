import SwiftUI

/// Shows content by growing its height from zero, so what is below slides down smoothly (a real accordion), instead of
/// the content fading in and jumping the layout. The content stays mounted, is measured once, and is clipped while closed.
struct Collapsible<Content: View>: View {
    let isOpen: Bool
    @ViewBuilder var content: () -> Content

    @State private var height: CGFloat = 0

    var body: some View {
        content()
            .fixedSize(horizontal: false, vertical: true)
            .background(
                GeometryReader { proxy in
                    Color.clear.preference(key: CollapsibleHeightKey.self, value: proxy.size.height)
                }
            )
            .onPreferenceChange(CollapsibleHeightKey.self) { height = $0 }
            .frame(height: isOpen ? height : 0, alignment: .top)
            .clipped()
            .opacity(isOpen ? 1 : 0)
            .accessibilityHidden(!isOpen)
            .allowsHitTesting(isOpen)
    }
}

private struct CollapsibleHeightKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = max(value, nextValue()) }
}
